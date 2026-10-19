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

## Authorized original retry result

Run `20261019-dungeon-siege-snapshot-original-1` used the exact candidate above.
The genuine EULA was visually reviewed and ordinary Accept click163,432 delivered
at batch2715213. EAX1 followed, then the original game thread and game window.
The previous CreateToolhelp32Snapshot fail-fast did not recur in this run; there
was no API trace proving the individual snapshot calls, so this observation does
not replace the eight compiled semantic tests.

The next concrete boundary was the game's `Dungeon Siege Demo Critical Error`
MessageBox: resource read error for `C:\demo.ds`, last error `0x00000017`, at
batch2715249. The text is established by `output.log`; the associated screenshot
is white, not a rendered error dialog. The original `Demo.ds` remains 196,629,356
bytes with SHA-256 `fdb7396ac9823e70d104147b145e2725640a9795bb3b2f5d2f5de55c12bd6505`.
No cause (corrupt original, emulator read semantics, compression or other) is
established by this error alone. No menu or gameplay was observed.

An ordinary control quit stopped the run after that boundary: exit0,82.359 seconds,
no guard trigger, no surviving process group, all recorded pins unchanged, minimum
free disk2,931,118,080 bytes. Registry70 entries and finalPNG exported; no VFS export
by design. Initial PNG was pending during startup but answered at batch5, and
later controls responded; the initial delay does not establish a deadlock.
The last error-side EIP `0x07500cb0` is a host API thunk; final thread EIP
`0x00634ab9` belongs to original DungeonSiegeDemo.exe, preferredbase0x00400000,
RVA0x00234ab9, a jump to0x00634a41. Neither is asserted to be the failed read site.

The run folder contains sealed `acceptance.json`, `observation.json`, original
terms, PNGs, logs, registry, controller, before/after pins and artifact hashes.
There is no exact Dungeon Siege entry in the candidate manifest, so no dashboard
`result.json` was attached to an invented or unrelated candidate. This follows
the Ops investigation-only rule for unregistered candidates. No automatic retry
or additional native test was run.
