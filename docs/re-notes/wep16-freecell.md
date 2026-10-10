# FreeCell (WEP2 / Win16)

`wep16_freecell` = `binaries/wep16/WEP2/FREECELL.EXE`, imports `CARDS`
(`cdtInit`, `cdtDrawExt`, `cdtTerm`), `KERNEL`, `GDI`, `USER`. The loader
reads `CARDS.DLL` from the exe's own directory (`loadWin16Dlls` in
`lib/dll-loader.js`), so it gets **WEP2's** copy. Tut's Tomb is the only other
WEP2 game that imports CARDS.

## The WEP2 CARDS.DLL fixture is corrupt — 2026-10-10

The archive's installed WEP2 volume ships a `CARDS.DLL` (md5 `de9893a7…`) that
differs from the copy in WEP1, WEP4, `win98-16bit/` and `dlls/` (md5
`14e9f672…`; same 148528-byte build, same resource table) in 1407 bytes, all
inside file range `0xc284`–`0xd1c0`: a run shifted by two bytes. It breaks
RT_BITMAP 678–684 and two cards:

- **id 1, ace of clubs**: renders with a solid black ~16×20 block over its
  top-left index, and the index sits ~16 px right. The bytes in the file look
  exactly like that (render the 1bpp BITMAPCOREHEADER at `0xc8b0`), so the
  emulator was drawing faithfully.
- **id 2, two of clubs**: its resource starts `00 00 0c 00 …`, so `biSize`
  reads `0x000c0000` and the bitmap does not load. The card, and its
  selection highlight (mode 2 = NOTSRCCOPY), draw nothing; the game itself
  still has the card, so the tableau looks one card short and a click
  "selects" an invisible card.

The 2026-10-03 browser evidence (`scratch/runs/20261003-wep16_freecell-gameplay-restored10`,
"black destination, no successful move proven") was this: the move did happen,
onto a card that cannot draw.

Fix: stage the intact build (`cp wep16/WEP1/CARDS.DLL wep16/WEP2/CARDS.DLL`).
`test/test-win16-wep2-gameplay.js` fails with that instruction while WEP2's copy
differs from WEP1's. The corrupt copy is kept in
`scratch/runs/20261010T1320Z-wep16_freecell-cards-dll-d10ba697/`.

## CARDS.DLL `cdtDrawExt` (seg 1, entry 0xf8)

`cdtDrawExt(hdc, x, y, dx, dy, cd, mode, rgbBgnd)`; the jump table at
`1:0x217` picks the blit by mode:

| mode | meaning | GDI |
|---|---|---|
| 0, 1 | face, back | BitBlt / StretchBlt SRCCOPY |
| 2 | highlight | NOTSRCCOPY 0x330008 |
| 3, 4 | ghost, remove | CreateSolidBrush(rgbBgnd) + PatBlt PATCOPY (4 returns there) |
| 5 | invisible ghost | SRCAND 0x8800C6 |
| 6, 7 | X, O | other bitmaps |

Bitmap id for a face card = `(cd & 3) * 13 + (cd >> 2) % 13 + 1`, so clubs are
1–13, and `cd = rank * 4 + suit` (A♣ = 0, A♠ = 3, 2♣ = 4, 4♣ = 12). After a
face blit it rounds the corners with GetPixel/SetPixel of the target DC.

## How FreeCell animates a move

All through `GetDC(main hwnd)` with three 71×96 memory DCs: one holds the
background under the card's old position (PatBlt green, then the card above it
drawn at y = -18), one the background at the new position, one the moving card
drawn with rgbBgnd 0. Each step: save the screen at the new position, patch it
with the overlap from the old buffer, restore the old position, blit the card,
swap. A cascade step is 18 px.

## Headless route

`node test/run.js --app=wep16_freecell --batch-size=20000 --repaint-every=5
--input=60:keydown:113,61:keyup:113,…` deals game #16813 (deterministic). The
2♣ ends cascade 1: `200:mousedown:43:300,205:mouseup:43:300` selects it,
`300:mousedown:40:80,305:mouseup:40:80` moves it to free cell 1, and FreeCell
then plays A♠, A♣ and the 2♣ home by itself (visible by batch 360).

At 640×480 the window opens at x = 22 and is wider than the screen, so the
eighth cascade is cut at the right edge.
