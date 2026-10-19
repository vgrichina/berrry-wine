# Original Dungeon Siege retry preparation

Source-only preparation on 2026-10-19. No original retry has run. All 37
extracted files (206,866,962 bytes) were freshly SHA-256 verified in both the
shared tree and recovery root. The ordinary app remains `dungeon_siege_demo`,
launching its original `DungeonSiegeDemo.exe` with no guest patches or injected
acceptance state. Existing acceptance evidence remains in
`scratch/runs/20261019-dungeon-siege-authorized-acceptance-2`: ordinary click
163,432, EULA returned 1, then the original snapshot call trapped. The original
terms and before/after images still match their recorded hashes. No persistent
acceptance state survived that crash; inspect the new EULA before ordinary input.

`tools/dungeon-siege-retry-preflight.js` performs data/source inspection only.
It checks both copies of all originals, acceptance evidence, the validated
module `7c1a12e8bc4b238e8caff2cc81adf85117dc630178cafc1f393a46ef60fc3b23`,
the actual production native dependency graph and disk admission. The root
normal build now matches that candidate; all eight compiled tests already passed
and are not repeated by this recipe.

The actual static native closure is BinkW32.dll, Mss32.dll and ole32.dll.
The prior launch warned that ole32 was absent. Its authentic local fixture is
`test/binaries/explorer98/dlls/ole32.dll`, 790,528 bytes, SHA-256
`bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d`.
This identifies the existing local Explorer98 fixture; this preparation has not
independently established its upstream distribution or licensing provenance.
The preflight refuses the former silent missing-native fallback. It also inventories
original mfc42/msvcrt/comctl32 fixtures, with hashes, without forcing their load:
they are not in Dungeon Siege's current startup graph. Additional dynamic
dependencies remain possible and would be a real next observed boundary.

The root owner can establish the missing ordinary fixture alias, without copying
or modifying original bytes:

```sh
ln -s /home/user/wine-assembly/test/binaries/explorer98/dlls/ole32.dll /tmp/wa-recovery-20261014/test/binaries/dlls/ole32.dll
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-preflight.js
```

Only after a fresh sole-runtime grant and successful preflight:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-controller.js 20261019-dungeon-siege-snapshot-original-1
```

The controller uses the previous ordinary launch settings (`--no-threads` retains
cooperative guest threads), a 90-second guest budget, 105-second graceful deadline
and 120-second outer process-group kill. Logs cap at 4 MiB and total evidence at
64 MiB. Admission must exceed 2,885,681,152 bytes: 2 GiB plus 128 MiB base reserve,
64 MiB output and 512 MiB transient headroom. The stop floor stays 2,214,592,512
bytes; the transient reserve is admission-only. Disk/output violations kill the
guest process group independently of its event loop. No automatic retry.

This is first-game observation, not an installation or persistence qualification.
There is deliberately no `--save-vfs`; full original-mounted VFS export could
need over 200 MiB and would require a larger admission. Original assets and prior
evidence stay intact. Fresh PNGs, logs and registry export capture this observation;
modified in-memory files will not survive it. Output captures are not gameplay
proof. The controller records source/original/native/module pins before launch
and checks them plus process-group absence afterwards.

Use ordinary control commands from the root during the run:

```sh
node tools/ctl.js -s :8141 png /home/user/wine-assembly/scratch/runs/20261019-dungeon-siege-snapshot-original-1/eula-before.png
# Inspect the current image; only if it is the same genuine EULA:
node tools/ctl.js -s :8141 click 163,432
```

Record input response and inspect a fresh after image. User authorization already
permits this ordinary Accept input. Do not assume that prior coordinates apply to
a changed dialog. Write acceptance/result receipts only from observed evidence.

Build storage estimate was about 24.36 MB for wasm/compat/combined products and
22.48 MB for retaining prior canonical wasm/combined, within a 128 MiB output
allowance; the completed root build's measured receipt supersedes that estimate.
The retry needs no new build and only small source/controller files plus evidence.
