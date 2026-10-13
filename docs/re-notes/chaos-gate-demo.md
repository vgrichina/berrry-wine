# Warhammer 40,000: Chaos Gate demo

Telegram saved request #56; compatibility fixture only. No gameplay or public
deployment claim. Investigation: 2026-10-13, source base `6aaf65235`.

## Fixture and extraction

- [Archive item](https://archive.org/details/Warhammer40000ChaosGateDemo), file
  `Warhammer40000ChaosGateDemo.zip`, 36,267,944 bytes,
  SHA-1 `7704f0d0f52db8ca0d3073488ea8d355b32dbe74`.
- Unzip, then `node tools/is5-extract.js installer/data1.cab --out=game`.
- Launch `game/WH40KDemo.exe`; retain the entire extracted tree, including
  `SMACKW32.DLL`, WinG DLLs, palette, and asset subdirectories.
- EXE SHA-256:
  `1b524bfb1e6db3decd24c446ad2d00158f8de97e60dee0ea50ce278eb05f4fe4`.
- Verified fresh download/extraction on `bx_gd476s95` at
  `/home/user/chaos-fixture/`; no payload copied onto the space-constrained
  persistent box.

## WinG implementation

The executable imports five WinG32 names: `WinGRecommendDIBFormat`,
`WinGCreateDC`, `WinGCreateBitmap`, `WinGSetDIBColorTable`, `WinGBitBlt`.
These were absent from the API table, and ordinary launch stopped at the first.

The implementation returns a complete indexed BI_RGB recommendation, allocates
real canonical GDI DCs and DIB sections, copies palette entries into bitmap-owned
storage, and performs SRCCOPY through the existing raster engine. Header writes
use guest translation across sparse pages. Invalid/unwritable recommendation
buffers fail before any write; bitmap creation checks the output pointer and
input header/table before allocation. No new JS pixel or palette shadow state.

Contract references: [original WinG SDK help mirror](https://rndtrash.github.io/windows-3.11-c-playground/docs/wing/wing33hw.htm)
and [Wine's WinG32 implementation](https://github.com/wine-mirror/wine/blob/master/dlls/wing32/wing32.c).
The recommendation is an output structure (no initialized input `biSize`
requirement), and does not return a palette. The chosen recommendation is
320 × 1, one plane, eight bits per pixel, uncompressed bottom-up; callers replace
dimensions and supply their palette before creating the bitmap.

## Validation and remaining blocker

Evidence run: `20261013T1145Z-chaos-wing`. Complete logs and source patch live at
`/home/user/chaos-wing-work/scratch/runs/20261013T1145Z-chaos-wing/` on
`bx_gd476s95`. Compact checked logs/captures copied to the persistent repository's
same run path. This demo is not yet a registered candidate, so no unrelated
candidate/result association was invented.

- Full `bash tools/build.sh`: PASS, including all build gates.
- `test/test-wing-recommend-dib-format.js`: PASS (complete header, palette/guard
  preservation, stack cleanup, NULL/wrapped/unmapped/partial ranges, ten sparse
  splits, actual DIB allocation).
- `test/test-wing-bitmap.js`: PASS (DC ownership, direct guest pixel storage,
  copied palette ownership, indexed-to-32bpp offset copies, later guest writes,
  invalid handles/pointers/formats, deletion).
- Existing `test/test-dib-section-straddled-info.js` and
  `test/test-wat-gdi-bitmap-handlers.js`: PASS.
- Negative control: replace only the recommendation handler with return-TRUE
  and correct stack cleanup. The recommendation regression fails on untouched
  `0xa5` header bytes. Source restored afterward.
- Whole repository unit/e2e/smoke suites were not run. Validation above is the
  complete build plus focused regressions, not a blanket suite claim.

Ordinary launch command (baseline and candidate):

```sh
node test/run.js --exe=/home/user/chaos-fixture/game/WH40KDemo.exe \
  --threads --vfs-include='**/*' --quiet-api --max-seconds=60 --max-batches=60000
```

Baseline WASM SHA-256
`d19c10b798cf71449551fa0387ce5e971c3c3c083aa47ca78f800a0fb7364d58`
traps at `WinGRecommendDIBFormat`, batch 9738. Candidate WASM SHA-256
`f7968aa1ed4941ff399c2d87f97451f723e4f98a3f3e7e34e712f6b8618b6f89`
passes that call and traps at **`mmioWrite`**, batch 35947. Node v24.18.1,
threaded CLI, 640 × 480. Both runs report absent optional `ole32.dll` and
`comctl32.dll` PE fixtures; this shared limitation remains explicit.

A bounded follow-up (`--no-build --quiet-blocks --max-batches=35000`, with
`--input=34000:png:.../startup.png --png=.../startup-end.png`) captured the
ordinary Games Workshop intro. Both captures were inspected. The full launch
crash exits before its normal final-PNG path, so the capture is a separate
pre-blocker run. It is startup evidence, not a menu or player control test.

Next: implement real multimedia I/O writes. At the first trap, guest EIP is
`0x004fa8d6`, caller return `0x004fa90d`, arguments are
`mmioWrite(0x6d4d0012, 0x074ce2b8, 0x27880)`. Keep the fail-fast handler until
the write semantics exist; do not skip the call or force a success return.
