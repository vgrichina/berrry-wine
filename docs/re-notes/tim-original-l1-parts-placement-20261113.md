# Original TIM v1.00: inventory assets and placement boundary

**New result:** L1 inventory types **2 and 6 resolve to original `PART2.BMP`
and `PART6.BMP` resources**, and both reach the ordinary placement handler.
Type **8 has no `PART8.BMP` member** and takes a separate attachment handler.
The ordinary handler has a byte-backed placement commit, but the decoded
sprites' appearances/names and the physical meaning of its button event remain
unresolved. This is a narrower first-input contract, not a gameplay result.

This follows the [L1 input-route note](tim-original-l1-puzzle-input-route-20261113.md).
It does not requalify the level parser or the released runner/test WIP. No
original EXE/overlay, VM, emulator, fixture, browser, game or build ran. No media
was downloaded, copied, mounted or written. No resource preview was generated;
there is no native frame, screenshot, solution or success claim.

Evidence: `scratch/runs/20261113-tim-parts-static-1020/`. The run's `inspect.py`
reuses only the prior identity/data-decoder prefix, redirects its outputs here,
and pins the prior helpers/manifests by SHA-256. It reads the borrowed image
read-only and verifies **all 1474560 bytes before FAT/member decoding**:
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.
All 11 FAT payloads and 159 predecessor member hashes match. The decoded
211216-byte analysis view matches
`090d7d0eed4a77e279fc48875aca96074ddb7ced167126b7ee987bf318bd1286`.
Decoded code stays in process memory and bounded anonymous objdump descriptors;
it is never replacement game bytes. No borrowed RAM file was removed or changed.

All code addresses below are **decoded-image offsets before load bias**; DS
offsets are original program offsets, never live guest/host input addresses.
Near branches printed across 64 KiB can wrap. The editing segment's paragraph
is `0x0dff`: its `CS:1cfe` table is at decoded `0xfcee`, not `0x1cfe`.
Leading/trailing partial instructions in bounded slices are not function entries.

## Numeric types to original resource bytes

At `0xf7f4`, the loader copies `DS:2625` (`part\0`), converts its type argument
to decimal with radix 10 at `0xf80d`–`0xf816`, appends it, then appends
`DS:262a` (`.bmp\0`) at `0xf82d`–`0xf835`. It passes that constructed filename
to far loader `248f:0682` (decoded `0x24f72`) and stores the returned handle at
`DS:0eba + type*0x3a` (`0xf851`–`0xf85b`). This is an executable-backed asset
association, not an association inferred from dimensions or later TIM releases.

| L1 inventory type | Original member | Bytes / SHA-256 | Resource metadata |
| --- | --- | --- | --- |
| 2 | `PART2.BMP` | 2043 / `fe1b8ff529d1feb3a46088b7cae15bcdfdc9d94d48aa88391da04f06aec80272` | INF count 4; arrays `[16,32,48,64]`, `[32,32,32,32]`; SCN 1977 bytes; OFF `[0,244,656,1234]` |
| 6 | `PART6.BMP` | 1570 / `c9003ef065a01f031142b43321b72cf772e7da7818b654fe97f06b10836ef0d8` | INF count 2; arrays `[48,48]`, `[32,32]`; SCN 1520 bytes; OFF `[0,746]` |
| 8 | **Absent** | No `PART8.BMP` in the verified 159-member index | Special handler; absence does not establish an ordinary name or prove that no artwork is used anywhere |

The resource index also lacks `PART10.BMP`; types 8 and 10 are paired special
cases in the code. This supports treating them separately, not naming either
one from familiarity. No original part-name text was established for 2, 6 or 8.
The table does not say which variant the selector displays, nor equate a resource
frame number with an inventory slot. An ordinary **numeric type 6 or 2** is now
a better-supported first selection candidate than type 8, conditional on fresh
native visual identification. Neither type is yet visually identifiable here.

## Container decoding reached; pixel decoding remains open

`asset-chunks.json` records the verified original chunk boundaries. Each chunk
has a four-byte tag and little-endian DWORD length; the high bit marks a
container, with low 31 bits its payload size. Every inspected tree consumes its
member to exact EOF. Each INF is exactly `2 + 4*count` bytes: a count WORD,
then two count-sized WORD arrays. Original INF reader `1c25:7282` (decoded
`0x234d2`) reads the count, separates the two arrays at `0x235c7`–`0x235d7`,
and copies each pair to descriptor fields `+6/+8` at `0x235f5`–`0x23602`.
This establishes the arrays' layout and descriptor destinations. They are
size candidates, not sufficient evidence of what any item depicts.

| Original resource | INF count | Remaining children |
| --- | ---: | --- |
| `CP.BMP` | 59 | `SCN:` 16895 bytes, `OFF:` 236 bytes |
| `GP_MENU.BMP` | 12 | `SCN:` 3910 bytes, `OFF:` 48 bytes |
| `PARTBIN.BMP` | 16 | `BIN:` 4723 bytes, empty `RLE:` |

For the SCN resources the OFF lengths equal `4*count`; the listed part offsets
are little-endian DWORD values. This is useful stream/frame boundary evidence,
but does not by itself establish the SCN command grammar or transparency.
The executable contains distinct `BMP:INF:`, `BMP:BIN:`, `BMP:SCN:`,
`BMP:OFF:`, `BMP:VQT:`, `BMP:RLE:` and `BMP:SCL:` lookup strings.
Loader `0x24f72` calls the INF reader and contains separate BIN/other branches;
it is not a Windows BMP/DIB reader. `PARTBIN.BMP`'s BIN prefix is
`02 c8 3e 00 00 05 ...`; calling the first byte a compression algorithm or
the next DWORD a decoded length would still require tracing the decoder.

**Precise format boundary:** structural chunks and INF arrays are recovered;
SCN opcode/row termination, OFF origin semantics, BIN decompression, pixel
packing, transparency and palette-to-renderer association are not established
by this run. It therefore stops before rendering. A future preview must first
prove those rules from these original bytes or a version-matched primary format
source, then label each extracted asset **ORIGINAL RESOURCE PREVIEW**. It must
not be presented as a native gameplay screenshot or assembled into a board.
No external source or media was fetched for this investigation.

## Ordinary placement: a concrete commit, an unresolved physical gesture

Selection callback `0x10e14` resolves a type through `0x5855`, saves the chosen
object in `DS:50d5`, and sets mode `DS:4e69=9` at `0x10ecb`. The existing
selection can also be cancelled through the callback's earlier mode-9 branch.
Only types 8/10 receive the special handling at `0x10ed5`–`0x10ee5`.

Dispatcher `0xfc0e` uses `(mode & 0x7fff)-1` to index its ten-word CS table.
For mode 9 the table entry is `0x1c9e`; adding the segment base `0xdff0`
gives `0xfc8e`, whose call at `0xfc90` reaches `0xfe47`.
`placement-dispatch.json` preserves the actual words and arithmetic.
At `0xfe47`, position fields `+1e/+20` are first set to `ffff`; type 8 goes
to `0xfe84`, type 10 to `0xff80`, and all others to `0x101dc`.
Thus **both L1 type 2 and type 6 use the ordinary path**.

The ordinary path recomputes candidate `+1e/+20` from cursor globals
`DS:5784/5782`, selection offsets `DS:4e97/4e95`, and viewport offsets
`DS:4ea3/4ea1`. Its non-`+0a & 8` branch masks with `fff0`, while the other
branch clamps against size/viewport bounds. These transformations are why stored
level values cannot serve as native click coordinates. It checks a predicate
through `0x3e23`; a nonzero result chooses cursor/status `0x0e` and skips the
commit. Calling that predicate a fully decoded collision or legality test would
go beyond the bounded trace.

When that predicate permits continuation and `DS:5774 == 2`, code
`0x10385`–`0x103ed` performs the placement transition: it updates the object,
copies `+1e/+20` into persistent `+8c/+8e`, calls `0x578c`, clears mode to 0,
and clears `DS:50d5`. Routine `0x578c` removes the object from its current
list and selects list `521b` or `5179` according to object flag `+6 & 4000`,
clearing inventory flag `0800` and setting `2000` or `1000`. This is stronger
evidence than a mere cursor preview: the selected inventory record has an
explicit commit-to-board path. No live placement was attempted.

**Precise control boundary:** event value `2` is the commit condition, not yet
a proven physical down/up edge. Poll routine `0x8136` merges queued input from
`0xaaca` with button query `1c25:5eee` (`0x2213e`), then compares previous
state `DS:286e` while synthesizing states 0/1/2. Query `0x2213e` reads a cached
button bit at `DS:48eb`; it does not directly return a DOS event in that call.
Neither the mouse callback that writes the cache nor all queued keyboard-button
producers were traced here. Hence this evidence cannot distinguish an ordinary
second click from a release-to-drop gesture across both input routes. A fresh
frame and bounded observed selection are still required; no speculative drag
or fixed hold interval is justified.

## Start/Stop and the next single-action proposal

The same hotspot dispatcher `0x8546` checks rectangle/event eligibility, invokes
callbacks and assigns its result word to `DS:4e6b` only when `DS:5774==2`
(`0x8591`–`0x85a8`). The game-list record initialized at `0x8bfe` supplies
`2000`; the next record at `0x8c36` supplies `1000`. These share the same
unresolved physical event edge as placement. Editing exits for `2000`, while
simulation `0x12ab` continues while `DS:4e6b==2000`. This connects control
activation and the edit/run state boundary. It does **not** identify their
visible artwork, labels, changed running-state hotspots, or native positions.
The 59/12-frame CP/GP assets are not a license to assign familiar icons.

After a separately authorized ordinary install/launch with the unchanged packed
EXE, require a **fresh real native frame** showing the already established L1
title/objective and stopped editing UI. The next proposal is one balanced
selection of a visibly identified ordinary type-2/type-6 inventory item. Review
the selected state before any further action. If its type cannot be tied to the
observed icon, record that boundary and stop input.

Only after that review propose one placement at a freshly observed empty legal
location using the UI's established gesture, capture the board/inventory
consequence, then separately identify and activate Start once. Capture a short
bounded consequence and activate the freshly identified Stop if still running.
Prearm an observable independent deadline/input-release watchdog for that future
runtime. This note supplies no hardcoded native coordinates, solution position,
password/manual answer, unlocking, injected state or success criterion beyond
an actual visible input consequence. An unresolved gesture/icon means stop and
report it, not try guessed alternatives.

## Validation and lifecycle

`inspect.log`, `validation.json`, chunk/member indexes, bounded disassemblies,
source pins and `SHA256SUMS.json` preserve the static checks. Exact Git SHA,
relevant binary diff and new document/helper patches preserve source context
without a source-tree snapshot or repeated media. Only this document is
published. No source/test changes, runtime tests or build qualification were
authorized or performed. Borrowed media final full hash is checked again.

Box ID **NONE**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
No runtime watchdog was needed because no runtime/box was created. No private
RAM files were created; borrowed evidence and other agents' WIP remain intact.
