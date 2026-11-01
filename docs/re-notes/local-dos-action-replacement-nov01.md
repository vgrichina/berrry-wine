# Local DOS action replacement: bounded dependency result, 2026-11-01

No title was selected and no original was launched. The ordered pool was only
`shadow-warrior`, `comanche3-demo`, `gta1-demo`. All three manifest payload
directories are absent in this checkout. This is a per-candidate dependency
result, not a claim that the broader local game pool is exhausted.

Static inspection used main `30e6cc597bfce541b19f8dfce5625ed8bf6f741f`, which
includes default-sequencer repair `77a0cea8828c82b262e17e71b4c60234abd2f4e6`.
Fresh inspection of the actual `lib/apps.js` `DESKTOP_APPS` array found 46 public
IDs; none names these three titles. Backend changes do not make an existing
qualified title new. The actual `test/binaries/dos-games/` directory contains
only `constructor-demo` at inspection time.

| Order / title | Exact missing local dependency | Eligibility and next bounded action |
| --- | --- | --- |
| 1. Shadow Warrior | All 161 DOS manifest files under `test/binaries/candidates/gog-free-shadow-warrior-classic/installed/app/`, including `Sw.exe`, `Sw.grp`, original `GAME.DAT` cue, `GAME.GOG` and companion data. The candidate root itself is absent. | Existing [title note](shadow-warrior-gog.md) already records reviewed original first-person combat through packaged DOSBox. A native backend is excluded as a new title. Preserve that qualification; restoring this payload alone would not make it eligible. |
| 2. Comanche 3 demo | All 11 installed originals under `test/binaries/toyvm-installed/comanche3-demo/`, including `C3.EXE`, `RESOURCE.RES`, `SETUP.EXE`, `C3.SAV` and icon. Original `test/binaries/win98-games-a-d/Commanche3-demo-SW/` is also absent. | Existing [title note](comanche3-demo.md) and catalog evidence already qualify ordinary cockpit/forward-flight/right-bank control on ToyVM. Excluded as already qualified. Preserve the recorded installed-export recovery recipe and saves; no reinstall or backend variant here. |
| 3. GTA 1 demo | All 117 files under `test/binaries/dos-games/gta1-demo/GTA24/`, including default `GTADOS/K.EXE`, `GTADOS/DEMO24.EXE`, `GTADOS/DOS4GW.EXE`, `GTADOS/UVCONFIG.EXE`, configuration and `GTADATA` companions. `test/binaries/dos-games/gta24.zip` is also absent. | No title-specific note or gameplay qualification was supplied by its catalog entry (`notes: null`). Missing complete pinned payload is the first dependency. A separately authorized recovery must restore the exact `gta24.zip` package/full tree and verify all 117 file hashes before any default startup. No download or recovery was performed. |

The GTA package pin in `test/dos-game-corpus/manifest.json` is 9,531,378 bytes,
SHA-256 `76f1e1da5c898f755597b86357c4d77b7447cb483673a23d10d34f40cfe03ec9`.
Its catalog startup is `GTADOS/K.EXE`, not an alternate direct `DEMO24.EXE`
launch. Expected executable SHA-256 values are:

- Shadow Warrior `Sw.exe`: `a36be0c4e286de1812e35cfce3248a54c559c60e6d5fd4651adf5e38439148b4`.
- Comanche 3 `C3.EXE`: `9d561246e9a5ac39ddb40949949373c9d4d5eeb6f99d67e64dc86df8aa0dfa5d`.
- GTA `GTADOS/K.EXE`: `8fd02d556e06f3258a6ca516ccf675e7aafbf313bd3c575e12dd0f8e5c67d48f`.
- GTA `GTADOS/DEMO24.EXE`: `2f1cedfb95254b2f1a8913f1aeac7a915966cb42c70c9c96b14b8861fbf78c9f`.

These are expected manifest identities, not hashes of locally present binaries.
Full expected per-file identities and actual absence are retained in the audit.
Shadow Warrior's historical innoextract recipe and Comanche's installed-export
recipe remain unchanged; neither establishes present payload availability.

Evidence: `scratch/runs/20261101-local-dos-action-replacement-nov01/` contains
`audit.py`, `audit.json`, `input-pins.json`, `disk-guard.log`, `cleanup.json`,
and `result.json`. The focused static audit passed: all expected paths checked,
46 public IDs inspected, exact ordered candidates retained. Input files are
SHA-256 pinned. No source/build mutation or expensive build was necessary for
this documentation-only change; accepted sequencer contract tests were not rerun.

An independent native disk guard checked `/home` against the unchanged
2,000,000,000-byte floor during the audit and was explicitly terminated,
actually waited, and directly verified absent. Evidence is below 2 MB; no
foreign artifacts were deleted. No original logging headroom decision or
90-second guest budget was consumed. Original OS wait and guest exit are
separately null because neither process nor guest existed; no loaded module,
first screen, screenshot, guest boundary or input response is claimed.

Runtime/source/build were never claimed. The action lane remained static and
did not consume the RPG lane's first runtime allocation or assume its release.
No boxes were assigned: box ID/state/expiry are N/A. Own helper shutdown was
delegated; shared fixtures, saves and recovery recipes were preserved.
The coordinator owns any successor assignment. Stop at this dependency result.
