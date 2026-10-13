# Silver original Windows demo

Status on 2026-10-13: original main menu and dock scene rendered;
player-controlled gameplay not verified.

## Original fixture and mounting

The Infogrames 1999 Windows demo is archived at
<https://archive.org/details/SilverDemo>. Publisher-era `install.ini`, demo
readme and licence identify the original demo. No installer or licence prompt
was executed or accepted in these investigations.

`SilverDemo.zip` is 129,637,371 bytes, SHA-256
`645db1f10f9fd77fcc22f3140648fc154e3d5680a9f88cd7fe8d834268e887ea`
(SHA-1 `a6af4d96fdc74b9649b1d96b513c416f8c65650b`). Native extraction yields
3,123 ZIP files plus 24 files from the original InstallShield cabinet. All
3,147 mounted C-drive files preserve the original file bytes. `silver.exe` is
1,694,720 bytes, SHA-256
`2301beb5100c6eb73eadcb700a2ce65e7b1221d2390207cbe3f07bc64df73ff8`.
Original `mss32.dll` and `smackw32.dll` are native DLL seeds.

The executable checks logical drives for `GetDriveTypeA == DRIVE_CDROM`, then
searches for `SILVER\LEVELS\VERDANTE\DAVHOUSE\DAVHOUSE.SCT` (68,940 bytes).
The existing harness's D drive has CD-ROM semantics. Keeping the extracted
tree at `C:/SILVER` and mounting the unchanged original ZIP with
`--zip=SilverDemo.zip --zip-root=D:/SILVER/` supplies the 3,123 read-only media
files. This passes the original CD search without game configuration changes,
invented registry keys, API overrides or a fabricated ISO.

## Requested flip-chain failure and fix

The original 8-bit startup path sets `DDSD_CAPS|DDSD_BACKBUFFERCOUNT` (`0x21`),
caps `0x4218`, and two backbuffers before `CreateSurface` at `0x41b8a3`.
`GetAttachedSurface` at `0x41b936` requests `0x4004` and succeeds; the next call
at `0x41b980` requests `0x4000` on that first backbuffer and fails with
`DDERR_NOTFOUND`. The actual error-dialog stack contains return `0x41b9af`.

The old implementation allocated only one backbuffer regardless of the
requested count. The generic fix allocates the complete chain with distinct
storage, marks only the first attached surface `BACKBUFFER`, rotates all
backing buffers on Flip, validates target overrides, reports the requested
count, and rolls back partial allocation failures. Linear ownership preserves
release behavior; a weak tail-to-front lookup avoids a reference cycle.
Existing explicit and mip attachments remain covered.

This follows the documented
[DDSCAPS roles](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddscaps)
and [Flip associations and target override](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-flip).
The change was reviewed/integrated as `3cc6e1c64`; the original tested three-file
commit is `e14f5d97c3cd2854bc1401ce3f51f1ef5ddb47bb`.

Canonical build from base `68e5e094a138c89f8c47898f2d68a64ab7a8318f` plus the
tested source produced module SHA-256
`46c1e23aabca26de5e459f21463d3e1167f3a71d95e573ffedecefe7b31765f7`.
The DirectX source SHA-256 is
`0bd81ce191e29a690ae560fadcde314b0c777692fc5d023b32f1be12ada603be`.

Nine focused suites passed: complex-surface release, explicit attachment,
mip chain, surface caps, Surface3 descriptor, surface enumeration, attachment
enumeration, D3DIM worker parity and GPU asynchronous Flip. The expanded
complex test covers double/triple/four-buffer storage and color rotation,
target/caps failures, retained intermediate references, COM-slot exhaustion
and DIB allocation rollback. On unchanged base source, the same test's narrow
negative control fails at the second requested backbuffer with
`DDERR_NOTFOUND`.

## Reviewed original runtime and remaining route

With the exact original C/D fixture, the new module passes startup and renders
the Silver main menu (Start, Load, Options, Quit Game). The first absolute
mouse move/click at `(320,362)` and Enter did not establish gameplay. No
approval or licence prompt was answered.

The last step request began at batch 232 and requested 120 batches. It never
returned a control reply before manual shutdown, while final statistics show
352 batches. Logs contain repeated zero-byte reads at `silver2.smk` EOF
`0x2c4a8`, notably at batch 261. These observations do **not** establish a guest
deadlock: step completion is settled on the next harness loop, and stdin
commands serialize behind a pending step. The final PNG is byte-identical to
the reviewed batch-222 menu capture.

Source inspection also found that the first absolute `handleMouseMove` has no
previous DirectInput point, so it initializes that point without generating
relative motion. The reviewed custom pointer remained around the menu's
center; the Start click may therefore have missed the guest's cursor. A
prepared follow-up uses the ordinary renderer motion contract to deliver
`directDx:0,directDy:112`, captures the pointer before clicking, and limits
subsequent steps to at most 20 batches. This remains an unexecuted hypothesis.

The prepared driver uses independent loopback HTTP controls so a pending step
cannot block snapshot/capture/quit. A timeout is recorded with before/after
batch and credit values, then captured and stopped; it never silently counts
as a successful step. No production harness or guest state is patched.
`--trace-api` is omitted because even a filtered trace sets `_debugReadFile`
and caused the prior 345 MB repetitive log. Output remains drained with an
8 MiB retained-log limit and explicit omitted-byte counts.

Evidence is in `scratch/runs/20261013T2254Z-silver-flip-original/investigation.json`:
74 transferred artifacts were SHA-256 verified, including a compressed copy
of the full raw log verified after decompression. Prior CD and startup evidence
is in `scratch/runs/20261013T2237Z-silver-original-cd-startup` and
`scratch/runs/20261013T2232Z-silver-original-startup`. Supervisor 177329,
driver 177330, guest 177353 and their process groups were absent at
`2026-10-13T22:56:19.682Z`; the runtime slot was released. Follow-up execution
requires a new coordinated runtime grant.

## Relative-pointer replay, 23:11 UTC

The next granted run used the same source closure, module and original media.
The relative `(0,+112)` motion visibly moved the custom pointer onto Start.
After inspecting that capture, a normal left-button down/up advanced out of
the menu. This confirms the previous absolute-pointer route had not tested a
correctly positioned Start click.

Loading initially showed black frames and an occasional small Silver logo.
Repeated snapshots often landed in the original loop at `0x43f96c`, but later
EIPs varied and the scene progressed. A read-only capture at batch 482 showed
an 18,000-slot table with 8,253 used entries. The original instructions scan
eight-byte entries for a zero first word. This evidence does not support
calling that loop a deadlock. The small steps all replied through the
independent HTTP channel; no pending-step recovery was needed.

By batch 1082 the game rendered a dock with a sailing ship, soldiers and other
characters, plus a Grunt portrait. The original readme documents Escape as a
cutscene skip. Escape during this scene opened an in-game menu containing
Load, Options, Quit Game and Back. A second Escape, intended to return from
that menu, instead reached the original promotional end card. The exact game
branch responsible for that transition remains unverified. No character
movement or combat was demonstrated, and this result does not establish
whether the route was interactive gameplay or a scripted demo sequence.

The next ordinary route should inspect the original Start/demo and Escape
semantics, avoid that second Escape, and attempt a visible world interaction
under a new runtime grant. Do not modify the game or invent a save/config to
skip the sequence.

Evidence: `scratch/runs/20261013T2311Z-silver-relative-start/investigation.json`.
All 224 artifacts (13,379,717 bytes) were transferred and SHA-256 checked.
The full output log is 6,258 bytes with zero omissions. Representative
captures are `002-pointer.png`, `capture-47.png` (dock),
`005-cutscene-skip.png` (in-game menu), and `006-return-world.png` (end card;
the filename records the attempted action, not its outcome).
Harness quit returned zero; supervisor 193010, driver 193011, guest 193019
and all three process groups were absent at `2026-10-13T23:14:54.862Z`.
