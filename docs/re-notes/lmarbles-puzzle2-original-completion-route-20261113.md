# LMarbles original Puzzle 2: static completion route from move12

The three remaining hints are legal and reach the original completion
predicate: maroon **(8,4) Left → (6,4)**, red **(5,1) Down → (5,3)**,
red **(3,3) Down → (3,4)**. The predicted remaining move counts are 15, 14,
and 13. This is static analysis; no CLEAR, completion animation, tally,
score award, or next-level transition was observed in this task.

## Retained board identity

Personally viewed the complete, unchanged 1024×712
[`move12.png`](../../scratch/runs/20261113-lmarbles-1505/move12.png), SHA-256
`3465b450e951157dc07cd48e59ec81b759291240ec4f76eca20ac4f072336fa2`.
It displays **LMarbles 1.0.8, Original, Tier 1 Puzzle 2, Moves 16, Score 0**.
The yellow marble has the blue selection ring. All coordinates here use the
parent's zero-based map indices, with centers `(98+32*x,154+32*y)` in that
retained full image. These coordinates identify the historical board; future
input must use a fresh native screenshot and its actual geometry.

| Original color ID | Visible color | Retained positions |
| --- | --- | --- |
| 1 | red | (5,1), (3,3) |
| 8 | maroon | (4,4), (8,4) |
| 9 | yellow | (5,4) |

The original `gfx/marbles.bmp` and `gfx/figure.bmp` rows independently support
those IDs: comparison of every ID and animation frame gives the lowest RGB
RMS for the stated ID at all five board cores and all five target cores.
This is a color classification check, not exact pixel equality. An initial
exact-RGB comparison failed; the display conversion was not established.
Personal full-frame review remains the board transcription's visual basis.

`lib/apps.js` registers `lmarbles_108` with the original
`test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe`, guest CWD
`C:\LMARBLES`, and that candidate's manifest. The EXE is 730,024 bytes,
SHA-256 `574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
Bundled `levels/Original` SHA-256 is
`f6cf4f13a52e8b2c52aac714dc02a70770297c627f27b5510d7dd228af1d30f8`.
Both match LM2350's supplied pins. This is LGames LMarbles, not Microsoft
Marbles. The [parent native note](lmarbles-native-clear-1505-20261113.md)
establishes the historical twelve reviewed moves and the unsent thirteenth
arrow; this task does not requalify that execution.

## Original resource and predicate

The **second level in the first chapter** (`Tutorial`, stone graphics) has
`limit=18`, `map_w=10`, `map_h=9`, `fig_w=4`, `fig_h=2`. Its bytes are:

```text
<figure>
  1 ;
1898;
</figure>
<map>
aaaaaaaaaa;
a  1  8  a;
a bb  bb a;
a b    b a;
a   8    a;
a  aaaa  a;
a  a..a  a;
a9 a..a 1a;
aaaa..aaaa;
</map>
```

Digits are marble IDs on floor, spaces are floor, `a/b/c` are walls, and
periods are outside/empty tiles. There are no arrows, teleporters, or crumbling
walls here. Replaying all twelve parent moves against this byte-derived map
independently reproduces the retained five positions exactly; the floor set
also equals the parent's visual transcription.

For source interpretation, inspected the upstream **1.0.8** code distributed
as [Debian source 1.0.8-0.2](https://sources.debian.org/src/lmarbles/1.0.8-0.2/src/).
This is a version-matched source reference, not proof of the Win32 compiler
inputs or a reproducible Win32 build. Full fetched file SHA-256/length/URLs
are retained in `upstream-source-pins.json`; no source archive was created.

In [game.c, G_CkFgr, lines 910–932](https://sources.debian.org/src/lmarbles/1.0.8-0.2/src/game.c/#L910),
the program tries translated figure origins and compares each nonblank figure
cell's ID with the map marble ID. Spaces decode to `-1` and are ignored: they
are wildcards, not required empty cells. It neither rotates nor reflects the
figure. The actual bounds are strict `< map_dimension - figure_dimension`,
so this level scans origins **x=0…5, y=0…6**. The final origin (3,3) is inside
those bounds. The five required cells use all five marbles in this level.

Crucially, the **original EXE confirms that predicate**, independently of the
source-version assumption. Its embedded `_G_CkFgr` short-name record at file
offset 665992 has section-relative value `0x39be`, section 1 (`.text`), hence
original VA **0x4049be**. Bounded disassembly through its return at 0x404b08
shows the `-1` wildcard skip at 0x404a22, marble-ID comparison at 0x404a7f,
done flag at 0x423340, and strict signed-less-than dimension loops at
0x404ade/0x404afa. The current-level pointer is 0x42332c. These are static
original addresses, not runtime memory observations or state-write targets.

Original `_Mr_Stp` is **0x4066f9**. At 0x4067ce it tests an ordinary stop
action; 0x40681a temporarily includes the selected marble in the map and
0x40681c calls 0x4049be. Thus the last marble need not be deselected to be
counted. The source's corresponding
[Mr_Stp](https://sources.debian.org/src/lmarbles/1.0.8-0.2/src/game.c/#L1569)
and move update describe that stop-time check and a one-move decrement.
The selected marble's temporary map absence is not a reason to reject the
visible five-marble goal.

The raw limit 18 does not contradict the initial visible 28:
[levels.c, L_Ini](https://sources.debian.org/src/lmarbles/1.0.8-0.2/src/levels.c/#L629)
adds `ceil(18*0.1*(5-0))=9` for Normal, then rounds odd 27 up to 28.
This explains the parent's initial counter, without reading or changing any
current configuration. Completion dispatch and profile-dependent bonus logic
are separate from the figure predicate; this task predicts no tally value.

## Reviewable remaining route

Each row assumes the previous row's exact state has been freshly observed.
Every position not named as moving remains unchanged. Select the specified
marble and review its ring before its arrow; release and review the settled
consequence before continuing. The old `select13.png` ring is historical and
does not replace a fresh selection review. No automatic input chain is supplied.

| Slide | Input and traversed cells | Stopping obstacle | Expected full settled state | Predicted moves / predicate |
| --- | --- | --- | --- | --- |
| 13 | ID8 maroon (8,4) Left via (7,4) to (6,4) | yellow ID9 at (5,4) | red (5,1),(3,3); maroon (4,4),(6,4); yellow (5,4) | 15 / false |
| 14 | ID1 red (5,1) Down via (5,2) to (5,3) | yellow ID9 at (5,4) | red (5,3),(3,3); maroon (4,4),(6,4); yellow (5,4) | 14 / false |
| 15 | ID1 red (3,3) Down to (3,4) | original `a` wall at (3,5) | red (5,3),(3,4); maroon (4,4),(6,4); yellow (5,4) | 13 / true at origin (3,3) |

The predicted final arrangement is:

```text
            x=3 4 5 6
       y=3   . . 1 .
       y=4   1 8 9 8
```

Dots here mean unused cells, not original map periods. A completion animation
may replace the settled view immediately after slide 15; Moves 13 and the
five-marble arrangement are computed expectations, not a promised persistent
frame. The worker must review the authentic visible consequence and any
completion/tally/next transition before claiming them. Stop and re-evaluate
if any native board consequence differs.

A bounded breadth-first enumeration finds no matching state at depths 0, 1,
or 2 (new-state layer sizes 1, 12, 80). Therefore three slides are minimal
under these static rules. This does not establish a unique three-slide order.
`static-route.json` includes every legal successor, with full expected state,
from the retained board and every route state. For convenience, the retained
board's complete legal-slide list is below; each changes only the named marble,
leaves the other four at their retained positions, and has false predicate.

| Marble at retained position | Legal direction → destination |
| --- | --- |
| red (3,3) | Right → (6,3); Down → (3,4) |
| maroon (4,4) | Left → (1,4); Up → (4,1) |
| red (5,1) | Left → (1,1); Right → (8,1); Down → (5,3) |
| yellow (5,4) | Right → (7,4); Up → (5,2) |
| maroon (8,4) | Left → (6,4); Up → (8,1); Down → (8,7) |

## Evidence and limits

Own evidence: `scratch/runs/20261113-lmarbles-puzzle2-static-0920/`.
`check.py` reproduces resource parsing, twelve-move replay, all successors,
the three proposed endpoints, exact predicate origins, and the depth-2 search.
`pixels.cjs` reproduces the supporting original-sprite color classification.
`original-G_CkFgr.disasm.txt` and `original-Mr_Stp-check.disasm.txt` retain
bounded native-byte disassembly; `original-symbols.json` records the exact
name/value locations. The system objdump global symbol-table reader rejected
this EXE's table, so these short-name records were read directly and their
addresses verified against decoded function entries and the real call target.

`input-pins.json`, exact Git SHA, relevant binary diff, owned-new-file patches,
and final evidence hashes preserve reproducibility without source or media
archives. Tests: static checker PASS, all ten color-ID checks PASS, native
predicate/call-site review PASS. Only the assigned document is committed;
no production code changed, so no build or emulator tests were required/run.
LM2350 was informed through the append-only board, and its helpers were not
edited. No game execution, browser, fixture, media download/staging, guest/save/
configuration write, capacity probe, cleanup, reserve change, or workers.
Box ID none; state NOT_CREATED; expiry null; stop receipt N/A; box deadline
watchdog N/A. The original runtime hold remains in effect.
