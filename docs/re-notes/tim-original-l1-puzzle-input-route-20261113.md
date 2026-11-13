# Original TIM v1.0: L1 recognition and first puzzle input route

Original bytes establish a substantially narrower target than “some TIM gameplay”:
**L1.LEV, format revision `0x0102`, `TUTORIAL:  PUT THE BALL IN THE HOOP`,
`Make the basketball go through the hoop.`** The level contains three ordered
object groups of **10, 4 and 9 records**. The last group feeds the parts selector
and contains three records each of numeric types **8, 6 and 2**. Their ordinary
names, selectable icon appearances and a successful arrangement remain unproved.

This is static recognition/input preparation. No installer, original executable,
overlay, VM, emulator, game, native fixture, browser or build was run. There is no
native frame or gameplay screenshot, and no startup, completion or compatibility
claim. The proposed action below requires later runtime authorization and fresh
visual review. Stored level values and disassembled UI rectangles are never
native input coordinates.

Evidence is in `scratch/runs/20261113-tim-l1-static-0950/`. The predecessor is the
[original DOS launch contract](incredible-machine-original-dos-launch-contract-20261113.md),
which supplies the unchanged installer/configuration/media prerequisites.

## Identity and reproducible static method

The borrowed `/dev/shm/wine-owner187-tim-disk.img` was opened read-only and its
entire 1474560 bytes hashed **before parsing**:
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.
All 11 payload hashes match the full FAT12 manifest in
`scratch/runs/20261113-tim-floppy-manifest-0825/manifest.json`; all 159 resource
member hashes match the predecessor's `resource-members.json`. No media copy,
archive, mount or guest/config/save write was made.

`inspect.py` reconstructs FAT member bytes in process memory using the verified
manifest's cluster lists. It reuses only the predecessor's literal LZ91
**data-format** decoder, with the predecessor script itself hash-pinned. The
211216-byte decoded analysis view must hash to
`090d7d0eed4a77e279fc48875aca96074ddb7ced167126b7ee987bf318bd1286`.
Original code is not executed. Bounded i8086 objdump slices pass through anonymous
memory descriptors that are closed immediately; no decoded EXE is staged.

Run `python3 scratch/runs/20261113-tim-l1-static-0950/inspect.py` to repeat the
identity checks and level parsing. `REPRODUCE.txt` lists the bounded disassembly
ranges. `source-pins.json`, exact Git SHA, relevant binary diff and the owned
new-document/helper patches preserve source context without a tree snapshot.

All executable addresses below are **decoded-image offsets before runtime load
bias**, and `DS:` values are original structure/global offsets, not host or live
guest addresses. Objdump's 16-bit printed near targets can wrap at 64 KiB;
cross-boundary targets require the containing segment context, not blind copying
of the printed number. Partial leading/trailing instructions and jump-table data
in bounded slices are not function entry evidence.

## What the actual level reader proves

RESOURCE.004 has L1's record header at `0x62d`; its payload starts at `0x63e`, is
1217 bytes, and hashes to
`c46d65ffa5f10d2a80c7c63e17c20fefa0294caa0d2ab76107762a496f843904`.
The payload offsets are:

| Payload offset | Original value | Reader-backed interpretation |
| --- | --- | --- |
| `0x00` | `ed ac` | Little-endian magic `0xaced`, checked at `0x122a0` |
| `0x02` | `02 01` | Format revision `0x0102`, read into `DS:5474` at `0x122ab` |
| `0x04` | Title above, NUL at `0x27` | NUL-terminated title into `DS:4ecf` |
| `0x28` | Objective above, NUL at `0x50` | NUL-terminated objective into `DS:4f1f` |
| `0x51`–`0x5e` | `400,300,67,272,65528,65528,1002` | Seven WORDs to `DS:50af,50b1,50b3,50b5,50b7,50b9,50bb` |
| `0x5f,0x61,0x63` | `10,4,9` | Counts for lists headed by `DS:521b,5179,50d7` |
| `0x65`–EOF | 23 records | Field-wise deserialization, not raw structure copies |

The seven header words are deliberately not called screen width/height or level
dimensions: those semantics were not established. In particular, `400,300` alone
cannot establish a 400×300 native frame. Format revision `0x0102` is also distinct
from the program's displayed version **1.00**.

Reader `0x12269` reads the header, adds all three counts for allocation at
`0x12353`, then passes each count and list head to `0x1221b`. WORD reader
`0x11dd1` reads two bytes; byte reader `0x11db4` reads one; string reader
`0x11dec` repeats until NUL. Record reader `0x11e3f` reads words into structure
offsets `04,06,94,0a,90,92,44,46,50,52,8c,8e,96`, followed by an optional
subrecord flag, bytes `56,57`, word `58`, conditional subrecords, attachment/link
fields and reference indices. Revision comparisons at `0x11e7e`, `0x12132` and
`0x12192` change the schema; treating every release's LEV as interchangeable is
unsupported. Type 7 has an additional conditional reference; L1 has no type 7.

The parser follows those reads, including both link-presence branches. L1 has
three 52-byte type-8 records and twenty 48-byte records: `101 + 3×52 + 20×48 =
1217`. The same parser consumes **all 87 original LEV members to exact EOF**,
all with revision `0x0102`. This corroborates serialization boundaries, not the
meaning of every flag or the runtime behavior. Full fields and references are in
`L1.parsed.json`; `level-validation.json` retains the cross-level check.

## Stored geometry and inventory, separated from any future frame

The following are exact serialized values with original destination offsets.
Pairs `A` and `B` are structure `44/46` and `50/52`; `P` is `8c/8e`.
They resemble size and initial-position fields, but this task has not traced
every initialization/rendering transform into native pixels. Treat them as
**stored geometry candidates**, not a diagram, solution or click list.

| Group / payload offset | Type | A = B | P |
| --- | ---: | --- | --- |
| `521b / 065` | 2 | 16,32 | 408,120 |
| `521b / 095` | 2 | 16,32 | 472,120 |
| `521b / 0c5` | 5 | 96,16 | 248,72 |
| `521b / 0f5` | 48 | 16,96 | 488,72 |
| `521b / 125` | 47 | 32,32 | 504,120 |
| `521b / 155` | 46 | 16,176 | 520,152 |
| `521b / 185` | 1 | 240,16 | 72,328 |
| `521b / 1b5` | 1 | 240,16 | 312,328 |
| `521b / 1e5` | 5 | 96,16 | 56,280 |
| `521b / 215` | 5 | 96,16 | 168,200 |
| `5179 / 245` | 9 | 32,32 | 248,40 |
| `5179 / 275` | 0 | 32,32 | 8,216 |
| `5179 / 2a5` | 0 | 32,32 | 72,248 |
| `5179 / 2d5` | 0 | 32,32 | 168,168 |

The third list's exact serialized inventory is:

| Payload offsets | Type / quantity | A = B | P values, in order |
| --- | --- | --- | --- |
| `305,339,36d` | 8 × 3 | 0,0 | `ffff,ffff` each |
| `3a1,3d1,401` | 6 × 3 | 48,32 | `ffff,ffff`; 280,184; 8,296 |
| `431,461,491` | 2 × 3 | 32,32 | `ffff,ffff` each |

`ffff` is a raw WORD (−1 if interpreted signed), not a usable coordinate.
Non-`ffff` fields in inventory records do not prove those parts are already
placed on the initial board. Types and list membership are stronger evidence
than assumed names such as rope, fan or pulley. This note does not assign those
names from familiarity with another TIM release.

The third-list interpretation has executable support: `0x123ac` makes `DS:50d7`
the selector cursor head (`DS:50d3`); `0x5855` walks that list by type, skipping
duplicate type records; `0x10e14` uses the chosen type and sets selection mode
`DS:4e69=9`. Special handling of types 8 and 10 in selection/placement is visible
at `0x10dd8` and `0xfd1a`. Therefore the first experiment should use a freshly
observed ordinary placeable item, avoiding an unreviewed attachment gesture.

There is an additional original recognition check, not a solution recipe:
the level-indexed callback at `DS:2632 + 1×4` points to `0000:151b`.
`0x1465` dispatches through that table. Callback `0x151b` searches list `5179`
for **type 9** and tests its live structure fields `1e/20` against bounds before
setting event `0x0200`. Together with the objective, this supports an inference
that type 9 is the objective basketball; sprite identification is still missing.
The static predicate alone is not proof of basketball/hoop collision semantics,
nor authorization to write those fields or force success.

## Original controls and the selectable-puzzle route

Original `READ.ME` explicitly documents these controls; `readme.json` retains
its exact text and payload hash:

| Input | Release-note meaning |
| --- | --- |
| Tab | Move cursor between hotspots |
| Arrow keys | Move cursor anywhere on screen |
| Space or Enter | Same as pushing the left mouse button |
| Esc | Bring up Control Panel |
| Alt-V in Control Panel | Version number |
| X / Y | Flip a shape |
| + / − | Size a shape |

Space/Enter is **not** documented as a global simulation toggle. No right-click,
drag duration, hotkey for Start/Stop, fixed Tab count or arrow-distance mapping
is established. Always balance key/button down with up; keyboard emulation of a
mouse button still needs later observation of the application's actual gesture.

The original UI resources are real container members, not standard Windows BMP
files merely because of the suffix. `CP.BMP` begins `BMP:` with an `INF:` child;
`GP_MENU.BMP` additionally contains `SCN:`; `PARTBIN.BMP` contains `BIN:`.
Their hashes, sizes and bounded headers are in `members.json` and
`recognition-pins.json`. The executable loads `cp.bmp` at `0xe1f6` and
`gp_menu.bmp` at `0xefa1`. This task has not decoded those graphics into labeled
icons or established a native panel image.

There is byte-backed separation of editing and running. Hotspot dispatcher
`0x8546` checks the current event mask and cursor rectangle, calls callbacks,
and, on its button-event condition, copies the hotspot's result word to
`DS:4e6b`. Original hotspot initialization includes result `0x2000` at
`0x8a4e` (panel list) and `0x8bfe` (game list), and result `0x1000` at
`0x8c36`. Editing loop `0xf8c2` exits for `0x2000` or `2`; simulation loop
`0x12ab` continues while the event is `0x2000`, runs object updates and the
level callback, and exits on other events. This supports Start/Stop-style state
transitions. The visible icons/labels corresponding to those records remain
unknown; no rectangles from disassembly are promoted to native input targets.

The original selector displays **SELECT PUZZLE** (`0xf4df`) and builds entries
as `PUZZLE <decimal number>: <title>` (`0xf703` onward). Name builder `0x12863`
constructs `l` + decimal argument + `.lev`, sets `DS:5472=1` (the header-rich
reader branch), and calls `0x12269`. The numbered scan at `0x129a8` starts at
1 and tests successive names. Thus the concrete ordinary candidate is **PUZZLE
1**, recognized by the exact L1 title/objective, not a freeform machine or L2.

The selector checks a candidate against the available/unlocked limit at
`0xf358`; its rejection path displays “You need to enter the correct password
in order to try this puzzle.” This investigation does not establish the runtime
initial limit, saved current puzzle, first screen, default selection or exact
panel hotspot that opens the selector. Choose Puzzle 1 through the observed
ordinary UI only if available. If already on the matching puzzle, no selector
detour is needed. Any actual manual/password prompt must be captured and the
run stopped there, without answers, unlocking, state injection or bypass.

## First later authorized balanced selection/place/start proposal

Prerequisites: preserve the verified image; finish an ordinary original install
and capture/hash its actual configuration and installed closure as described in
the launch contract; launch the unchanged packed TIM.EXE from its actual game
directory; prearm an observable independent deadline and input-release watchdog.
The released runner/test WIP is not qualified by this static work.

1. Capture the actual first screen and prompts. If needed, use one Esc down/up
   to open the Control Panel, visually locate the puzzle selector, and choose
   the available **PUZZLE 1** through ordinary controls. Review a new capture
   after every transition. Require the L1 title/objective and a stopped editing
   board; otherwise record the mismatch and stop this proposed experiment.
2. From that fresh native frame, identify one visible ordinary placeable item
   in the parts inventory and an empty legal board location. Record their
   reviewed native coordinates or actual focused hotspots in the future run's
   evidence. Select exactly one item with left-button down/up (or one observed
   equivalent Space/Enter down/up). Capture the selected state before proceeding.
3. Move the cursor to the freshly reviewed empty location and use exactly one
   balanced placement gesture matching what that UI has visibly established.
   A second click-to-place is a proposal, not a proven gesture; if the UI instead
   requires a held-button drag, stop and revise the bounded gesture after review.
   Capture placement and the changed inventory/board. Do not choose a position
   from the stored numbers above or claim it is a solution.
4. Only when the fresh frame identifies the ordinary simulation Start control,
   click it once with down/up. Capture a short bounded before/after interval and
   record actual motion or the precise failure boundary. Use the freshly
   identified Stop control once with down/up if the machine is still running;
   retain a final stopped frame and the watchdog/input-release receipt.

This proposes one selection, one placement and one start, with a stop/release
tail. If selection, legal placement or Start/Stop identification is not possible
from the actual UI, preserve that concrete missing evidence instead of sending
speculative input. Success for this milestone is **real original puzzle input
and a visible consequence**; solving the puzzle is neither assumed nor required.

## Validation and limits

Full image/payload/member identity, the decoded analysis hash, all 87 exact-EOF
parses, the L1 offsets/counts/types and documentation whitespace were checked.
`validation.json` and `SHA256SUMS.json` retain the checks and evidence seals.
Only this document is published; the run-specific static helper/evidence stay
ignored. No build or runtime tests were appropriate or authorized for this
documentation-only static assignment.

Remaining evidence includes named sprite/type mapping, proven geometry-to-frame
transforms, native panel/puzzle frames, actual unlocked state and selector entry,
placement gesture, Start/Stop icon identity, runtime resource/device behavior,
and input consequences. No static drawing or fabricated gameplay screenshot was
created. Borrowed RAM media remain untouched; no private RAM files were created.
Box ID **NONE**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
No runtime watchdog was created because no runtime or box was created.
