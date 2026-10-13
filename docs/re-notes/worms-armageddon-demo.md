# Worms Armageddon demo

Original Team17/MicroProse Windows demo v1.0, February 1999. This is a
different game from the qualified Worms 2 demo. It is not registered or public.

## Original fixture

Source index: <https://bbsfiles.retropc.se/filegate/gamesnet/demo/index.html>.
Original archive: <https://bbsfiles.retropc.se/filegate/gamesnet/demo/wademo.zip>.
Downloaded archive: 13,922,708 bytes, SHA256
`e7b83c05b152a6f47187ef4367cbade4874827c791e17fac05a18ab48090a5df`.

The ZIP contains a WinZip self-extractor, `WaDemo.exe` (13,931,008 bytes),
SHA256 `f42800ec0831e43458e854de8befd075364dd2b442459ae221e68f4116a2d64e`.
Extract its complete installer with 7z, then use `tools/is5-extract.js` on
`data1.cab`. This produces 667 files totaling 20,639,487 bytes. The actual game
`WaDemo.exe` is 2,020,352 bytes, SHA256
`7d6c456c0bd0f4bb197f0305e63e58aeb4868d325cc0110c74bb9d6e968c9bfd`.
Keep the complete tree at `test/binaries/candidates/worms-armageddon-demo/game`.
The source and payload remain ignored compatibility fixtures. The README says
all rights reserved; no redistribution permission has been established.

## Launch and documented controls

A bare EXE route needs explicit seeds for the game's bundled DLLs. Without
DXMfc.dll the first constructor becomes an unresolved API; that is a missing
launch dependency, not a request to implement the game's C++ method in WAT.

```sh
node test/run.js \
  --exe=test/binaries/candidates/worms-armageddon-demo/game/WaDemo.exe \
  --vfs-include='**/*' \
  --dll-seed=test/binaries/candidates/worms-armageddon-demo/game/DXMfc.dll \
  --dll-seed=test/binaries/candidates/worms-armageddon-demo/game/DirectSound.dll \
  --dll-seed=test/binaries/candidates/worms-armageddon-demo/game/DirectX2D.dll \
  --quiet-api --control=8139 --frozen --max-seconds=180 \
  --batch-size=10000 --tick-ms-per-batch=5
```

The original Manual.rtf gives the ordinary route: Single Player, then Play
Quick Game Against Computer. Left/Right move, Return jumps, Backspace jumps
upward, Home centers the active worm, and Space attacks. The README documents
three missions, two training modes, and no streamed audio ambience in this demo.
Menu positions and the gameplay route are not yet measured.

## First bounded launch, 2026-10-13

Full build passed on main `c0c53c2f3a28d8f63481fe64dd6c861fb6f80256`;
Wasm SHA256 `c9971c0abb023c64c8c018505e39734eeb1be52076a23d4846d54385b50b5c07`.
Remote worktree `/home/user/wa-work` on `bx_yqnspudj`; software CLI with
cooperative guest threads. Evidence:
`scratch/runs/20261013T1937Z-worms-armageddon-launch`.

After correcting missing pngjs host dependencies and supplying original DLL
seeds, the game rendered Team17, MicroProse and the upper Worms title. Captures
were reviewed. Escape was sent on the two publisher logos, at batches 477 and
714; no menu selection was attempted without a visible menu. Final capture was
batch 1025, guest time 5125 ms. The control quit completed after 1028 batches,
191.003 seconds and 5,101,010 API calls. The coordinator confirmed the process
absent at 19:41:40 UTC. No compatibility trap occurred on this corrected route.

This is incomplete startup coverage, not a proven compatibility failure.
No menu, gameplay, movement, audio or FPS qualification. Next allocated run:
increase the batch budget before interpreting timed startup behavior, use a
coherent guest-clock setting, inspect each next screen, and follow the original
single-player quick-game route. Keep the existing captures as the baseline.
