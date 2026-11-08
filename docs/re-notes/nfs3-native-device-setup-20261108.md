# NFS3 native 3D Device Setup: Win9x device enumeration blocks selection

The authentic bundled `game/Setup/3dSetup/3DSetup.exe` now has a locally
reproduced platform blocker: it cannot open
`HKEY_DYN_DATA\Config Manager\Enum`. The ordinary device chooser never
appeared. No Direct3D selection, setup-to-game renderer transfer, acceleration,
steering or road displacement is accepted. No remote box was allocated.

Evidence: `scratch/runs/20261108-nfs3-native-device-setup/`.
The registration candidates are retained as patches there, **not shipped**.
All shared code changes were reversed after qualification failed. This commit
contains only this note.

Read `CLAUDE.md`, the predecessor's current-race-renderer note, and the shipped
English readme. The readme explicitly describes the separate 3D Device Setup
utility and its OK button. Its invocation is permitted for this task. No
renderer registry values, clock/RNG overrides, guest patches or private-handler
calls were supplied. There was no input injection, including no error-dialog
ACK; each local probe ended by closing its own browser in `finally`.

The smallest candidate added two local-only registrations: the original setup
EXE with its actual `C:\Setup\3dSetup` working directory, and the original game
EXE with no startup renderer values. Both used the existing 133-entry manifest
and shared `StorageImports` store; existing Glide registrations were unchanged.
The first production Chromium Worker run displayed **“Error! Could not open
game registry key.”** A traced repeat established failed native opens of both
`HKLM\SOFTWARE\Electronic Arts\Need For Speed III Demo\1.0` and the parent
game key. The registered game fixture is a file tree, not a completed native
installation registry.

The bundled `Setup/english/SETUP.INS` names the game's `DisplayName` installation
value and the game name. A second candidate supplied only this non-renderer
installation metadata through existing `startupRegistry`. That resolved the
game-key dependency. `install-metadata-local-console.log` then records:

```text
[reg] open  HKLM\SOFTWARE\Electronic Arts\Need For Speed III Demo -> found
[reg] query  HKLM\SOFTWARE\Electronic Arts\Need For Speed III Demo\3D Device Description -> not found
[reg] set    HKLM\SOFTWARE\Electronic Arts\Need For Speed III Demo\3D Device Description (type=1) = ""
[reg] open  HKDD\Config Manager\Enum -> not found
[MessageBox] "3DSetup": "Error! Could not open HKEY_DYN_DATA\Config Manager\Enum."
```

The empty device-description write is the **original utility's own write**, not
a host-supplied renderer choice. It appears in the exported shared registry.
The actual production guest main thread ran in a Worker, and the reviewed PNG
shows this second error. Current `lib/storage.js` recognizes HKDD and provides
PerfStats, but supplies no Config Manager enumeration. Its ordinary open-key
implementation correctly reports an absent key. Merely removing the Glide
startup values does not supply the missing Win9x platform service.

The installer script also names `3ddata.exe` before `3dsetup.exe`; the shipped
`3ddata.exe` contains the EA 3D Data catalogue keys. That is static evidence of
another installation dependency, **not a demonstrated next failure**. Neither
the installer nor `3ddata.exe` was executed. The task's alternate-EXE exception
covers `3DSetup.exe` only. A supported continuation needs real emulated Win9x
device enumeration and any necessary native installation bootstrap; it must
not synthesize a chosen renderer or bypass the utility's detection.

Validation and limits:

- All 133 existing media paths, sizes and SHA-256 pins were reverified:
  22,070,305 bytes. No media or source archive was created.
- The first registration candidate passed
  `flock /tmp/wine-build.lock bash tools/build.sh`. It updated the conservative
  `lib/apps.js` census hash after reviewing declarative metadata only.
  `test/test-storage-registry.js` passed, including cross-run snapshots.
- The broader `test/test-debug-game-apps.js` failed on preexisting Uplink
  local-only/publication assumptions. A candidate correction exposed another
  stale Uplink DLL-list assertion. Neither correction nor NFS3 assertions were
  committed. There is no passing broad app-suite or completed state-transfer
  regression claim. The second metadata candidate was probed, then reversed;
  no passing locked build is claimed specifically for that second candidate.
- Sources are recoverable from recorded Git SHAs plus binary diffs and the
  relevant untracked-file patch. The recorded recovery base after the first
  probes is `14057deaaddff2b8f32ea3459d545570b4df468a`; the metadata candidate
  ran while main advanced to `05d0a68674588896599a232b7ffd23e4b427b50f`.
  These are recovery bases, not atomically observed executing-source snapshots.
- The successful build's retained on-disk module is 2,182,500 bytes, SHA-256
  `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
  The probes use the production static-server/Worker path. They did not retain
  a fetched-module digest, so this on-disk pin is not strict executing-module
  identity acceptance. No D3DIM context, renderer DLL selection or fallback
  acceptance was attempted. Physical GPU is unknown.
- Local disk samples were around 5.05–5.09 billion bytes (about 4.7 GiB), below
  5 GiB. No runtime allocation was attempted while qualification was failing.
  No RAM gate, old-box resume/delete, public deployment or nested worker ran.

Box ID, expiry and stop receipt are **null**; final state is **not allocated**.
No watchdog was armed because no box was created. No owned remote runtime is
left billing. Local probe browsers exited normally. Strict action qualification,
independent releases and exact ACK deadlines remain prerequisites for any later
original-game input. Three-renderer warmed benchmarks, full27 and audio remain
open, as do current race controls and setup-to-D3D transfer.
