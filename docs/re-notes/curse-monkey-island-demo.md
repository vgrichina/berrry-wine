# The Curse of Monkey Island demo

The local original demo comes from the Windows 98 A-D distribution linked
in `sources.md`. The package and playable files remain local-only.

- `COMI.EXE` SHA-256:
  `b55524231edacc7d184c22c762d25193d616adc55d0141785fb21b8890d352b9`
- `CURSE.EXE` SHA-256:
  `b635bef2e58c91faa9592ea19200ffa031a44e8d55a4cd62245e392aef3683f3`

The bundled README identifies demo 1.0 and requires Windows 95, a Pentium,
16 MB RAM, CD-ROM, and a mouse. `CURSE.EXE` is the original launcher: a real
emulated launch displayed Play, Install DirectX, Readme, Troubleshooting,
and Exit. It reached the child-launch yield without a game-copy wizard.
The top artwork panel was initially blank; the etched-static fix below
restores it.
The registered app runs `COMI.EXE` with the original 11 companion files.

## Functional acceptance

`test/test-comi-gameplay.js` uses the frozen headless CLI, skips the opening
dialogue with Escape, and clicks the hold floor at `(250,390)`. Before and
after screenshots show Guybrush standing at the right wall and then walking
toward the center. The test measures his distinctive cream-shirt palette
pixels, requiring a leftward displacement greater than 60 pixels, rather
than counting cannon animation or mouse-cursor changes as player movement.
The verified run measured x=438 to x=335 and exited cleanly.

Screenshots are written to `COMI_SCREENSHOT_DIR` or the temporary directory
`wine-assembly-comi-gameplay`. The test pins the original executable hash;
its palette assertion is specific to that demo and scene.

The regression also right-clicks to open the inventory chest, closes it,
then holds the left button over the small pirate to open the verb coin.
Both captures were visually inspected. Region-specific brown chest and
gold coin pixel thresholds assert those controls appeared; selecting a
verb and completing the demo's puzzle remain unverified.

## Launcher artwork investigation

The blank panel is not evidence of an absent bitmap resource. `CURSE.EXE`
contains bitmap resource 184, and its launch trace calls `LoadImageA` for
that resource with dimensions 240x197 and `LR_CREATEDIBSECTION`, followed
by a successful `BitBlt` into the dialog at `(0,3)`. A static child occupies
the same rectangle. Trace control paints and DC targeting before deciding
whether loading, rasterization, or a later repaint loses the artwork.

The resource header is a 40-byte BITMAPINFOHEADER: 320x240, 8bpp,
BI_RGB, 76800 pixel bytes (raw PE offset `0x2cefc`). The overlapping
dialog-102 static is control 1003, style `0x50000012`, not SS_BITMAP.
`--trace-ctrl` confirms it paints at screen `(199,77)` with extent 240x197.
The LoadImage result selected into the source DC is nonzero (`0x410005`).
These observations narrow the next probe to actual bitmap pixels and
destination/repaint behavior; a successful BitBlt return alone does not
prove visible rendering. The bounded 80-step probe exits cleanly.

### Etched frame fix

The cause was static-control painting: a four-bit type mask changed
SS_ETCHEDFRAME (`0x12`) into SS_RIGHT (`0x02`), then its text-label fill
erased the parent's artwork. Preserve five type bits and handle etched
horizontal, vertical, and full frames with EDGE_ETCHED and the appropriate
border flags, without BF_MIDDLE. This follows the
[static-control style contract](https://learn.microsoft.com/en-us/windows/win32/controls/static-control-styles).

`test/test-static-bitmap-control.js` seeds colored interior pixels and
checks all three etched styles across repeated paints, including which
edges change. It failed gray before the fix and passes afterward, alongside
the existing resource/dynamic bitmap coverage. The original launcher now
shows the moon, sea, and Guybrush in his boat; its capture was inspected.
The art region changed from zero to 38238 chromatic pixels. Canonical and
compat builds pass, as does the full COMI movement/inventory/verb-coin test
against the new build. This verifies artwork presence, not exact LoadImage
scaling fidelity or every launcher button.

## Hot loop: the destination-blended LUT at `exe+0x40340e`

The #1 hot block across three profiling windows, at **11.62 / 11.72 / 11.68%**
of block entries (spread 0.11pp — flat, unlike most hot-loop measurements), and
**35.12 / 35.24 / 35.14%** for the region within ±0x60.

```asm
0040340e  mov dl,[eax]          ; src index
00403410  inc eax
00403411  cmp dl,0xff
00403414  jz short 0x40343a     ; transparent
00403416  cmp dl,0x8
00403419  jnb short 0x403438    ; opaque passthrough
0040341e  mov bl,dl
00403422  shl ebx,0x8
00403425  mov dl,[ecx-0x1]      ; dst index
00403429  mov dl,[ebx+edx+0x4d30d0]   ; 64KB blend table
00403430  mov [ecx-0x1],dl
00403433  jnz short 0x40340e
```

A destination-blended 2D lookup, `dst = tbl[(src<<8)|dst]`, table at
`0x4d30d0`. Both branches target addresses *past* the back edge, so they are
loop exits with no internal edge — which makes this a `SELFEXIT`, not a
self-loop, and therefore invisible to `$loop_match_block`: the decoder splits
the block at the first `jz`. See §22 of
[loop-idiom-superops-design.md](../loop-idiom-superops-design.md).

`tools/find-ck-lut-nests.js` classifies it `LUT8_NOKEY`. `tools/match-loops.js`
on COMI: 956 loops, 58 matched (6.1%), 203 `multi-branch` declines.

## Frame counter qualified (2026-10-10)

Route as in `test/test-comi-gameplay.js` (100,000-block batches, 200 ms tick,
`--no-threads`): Escape at batch 150, floor click (250,390) at 232 walks
Guybrush from the right wall to the click point. Over batches 232-632
`--present-distinct` counted 1,961 presents on slot 1, and they split exactly:

- **1,809 frames** — the primary surface's `Lock`/`Unlock`, all from one site
  (`Lock` returns to `0x444ef4`, `Unlock` to `0x444f74`). No Blt or Flip.
- **152 palette updates** — `IDirectDrawPalette::SetEntries` from one site
  (return `0x44484b`), about 15 per 40 batches: palette cycling, not frames.

So the frame counter is the `Unlock` site: `set_count(0x00444f74)` or
`--count=0x00444f74`; read `dx_present` as frames + palette updates. That is
~22.7 frames per guest-second at this tick, steady across ten 40-batch samples
(157-188 each); 1,258 presents repeated the previous picture, since SCUMM
redraws every tick. Evidence: `scratch/runs/20261010T0440Z-cmi-control-frames`.
