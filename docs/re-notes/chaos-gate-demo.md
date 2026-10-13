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

The next blocker after the WinG implementation was multimedia I/O writes. At
the first trap, guest EIP is
`0x004fa8d6`, caller return `0x004fa90d`, arguments are
`mmioWrite(0x6d4d0012, 0x074ce2b8, 0x27880)`.

## Fixed memory-file writes (follow-up)

The trapped `0x6d4d0012` handle belongs to the existing FOURCC_MEM slot table.
The original EXE opens the output memory file at `0x004fa29d` with flags
`0x11011` (WRITE, CREATE, ALLOCBUF, exclusive sharing), and compares the write
result to the requested count at `0x004fa913` before continuing.
`mmioWrite` now copies into that slot's guest buffer at its cursor, accepts at
most the remaining capacity, advances by the actual accepted count, and extends
the recorded data length without shrinking it on overwrite. Writes are already
materialized in the memory backing, consistent with the existing memory-file
`mmioGetInfo` clear-DIRTY behavior. Expandable memory files still fail fast at
open; no resize, custom IOProc, or flush implementation is claimed here.

Negative counts, invalid/closed handles, read-only memory handles, and invalid
source/destination ranges return -1. Both ranges are checked before copying,
including sparse page permissions, so an inaccessible tail cannot partially
change the buffer or cursor. A full fixed buffer returns zero; a request larger
than the remaining space returns the short count. Disk handles use the existing
host writer and its actual result, with MMIO open access mapped to read/write
flags. A zero-byte write validates the handle but never invokes the legacy
zero-byte `_hwrite` truncation behavior.

Contract references: [Microsoft mmioWrite](https://learn.microsoft.com/en-us/windows/win32/api/mmiscapi/nf-mmiscapi-mmiowrite)
and [Wine MMIO implementation](https://github.com/wine-mirror/wine/blob/master/dlls/winmm/mmio.c).
The focused regression is `test/test-mmio-write.js`: actual buffer/readback
bytes, cursor/length state, overwrite, short/full/zero writes, invalid counts
and handles, non-adjacent sparse pages, missing/read-only/no-access tails,
guards, host write errors/short counts, and real dispatch stack cleanup.

Validation run `20261013T1205Z-chaos-mmio` executed on `bx_gd476s95` at
12:21–12:22 UTC, using the same original fixture and threaded CLI environment.
The full build and `test-mmio-write`, `test-wat-mmio`,
`test-mmio-info-sparse`, `test-mmio-descend-lazy`, and
`test-mmio-ascend-odd-offset` all passed. A count-only success replacement was
rejected by the first stored-byte assertion; the real source was restored and
its hash verified. Whole repository suites were not run.

The prior WinG module hash was verified before building; candidate WASM SHA-256:
`0001a582fbfd6ac300aeb42fb0b3a55eb2d6ea4f9d7950df943220ff6a9fc02b`.
Launch used the command above plus `--no-build --quiet-blocks`, a batch-40000
capture, and a final capture. It completed the 60000-batch bound in 15.207s
without a new API trap. The final image renders the Chaos Gate main menu with
five icon-bearing buttons; text labels are absent in this capture. This is
menu-rendering evidence, not proof of functioning controls or gameplay.
Missing optional `ole32.dll`/`comctl32.dll` PE fixtures remain unchanged.

Complete evidence is in the remote checkout's run directory, with a compact
copy in the persistent repository's same run path. Next: qualify ordinary menu
input into a mission and investigate any actual next failure, including the
unverified button text behavior. No subsequent unimplemented API is established
by this bounded launch. Expandable memory files/custom IOProcs remain outside
this implementation.

## Ordinary pre-mission input qualification

Run `20261013T1236Z-chaos-gameplay` uses the unchanged MMIO candidate module
above, Node v24.18.1, threaded CLI, 640 × 480, and the original extracted
fixture on `bx_gd476s95`. A real pointer click at `(320,225)` at batch 60000
opens the Cathedral Bridge. Clicking its green briefing display at `(320,245)`
opens a readable mission briefing. Clicking the skull at `(320,435)` returns
to the hub; its far-right door at `(580,330)` opens the squad loadout with
rendered marine, weapons, statistics, and character name. These are actual
renderer input events with DOWN/UP delivery recorded by `--trace-input`;
no guest-state writes.

The fixture's `Chaos_Demo.txt` documents the required route: read the briefing,
click its skull to return, enter the far-right Configure Squads door, leave
loadout through its right-hand doors, then enter the center-left Enter Battle
door. The center foreground floor is not the deployment control. Main-menu
button labels remain absent, but the hub tooltip and briefing text do render.

Loadout exits through `(565,105)`. Hovering `(130,330)` on the hub then shows
`Enter Combat <E>` and highlights the center-left door. Clicking it at batch
115000 starts mission loading and creates guest thread 3 at `0x004b8e60`
with `CREATE_SUSPENDED`, parameter `0x00978fc4`, handle `0x000e1002`.
The run subsequently stops returning from main `instance.exports.run(BATCH_SIZE)`: no
batch-140000 image, final image, API trap, or CLI 70-second timeout appeared.
It remained CPU-active beyond 90 seconds and did not service SIGTERM.
A Node inspector pause at 12:42:09 UTC captured `$func546` (`$th_block_retired`,
mapped using this module's combined WAT), `$run`, and the main JS `run` call.
This identifies an active interpreter run, not the guest instruction causing
it. The process was explicitly killed at 12:42:28 UTC (exit 137), and the
remote runtime slot released. No battlefield or player control is qualified.

Reproduction (append image actions from `evidence.json` for the saved route):

```sh
node test/run.js --exe=/home/user/chaos-fixture/game/WH40KDemo.exe \
  --threads --vfs-include='**/*' --no-build --quiet-api --quiet-blocks \
  --max-seconds=70 --max-batches=150000 --trace-input \
  --input=60000:click:320:225,70000:click:320:245,80000:click:320:435,90000:click:580:330,100000:click:565:105,115000:click:130:330
```

Use an external process deadline as well as the CLI guard for this reproduction.
Next investigation: capture guest EIP/registers and thread state while paused
inside this non-yielding `run`; test whether the default uop path or mission
synchronization is responsible. Neither is established by the captured stack.
No emulator source changed in this input-qualification follow-up, so no build
or regression suite was rerun. The prior build/test evidence remains separate.
Missing optional `ole32.dll` and `comctl32.dll` PE fixtures remain explicit.
