# Mad Bomber 0.2.5 — original Windows package

Source-only candidate preparation, 2026-10-18. No build, guest execution,
browser, registration, gameplay, performance or publication claim.

## Selection and provenance

Mad Bomber is a distinct game absent from the current `DESKTOP_APPS`, local
candidate list, candidate corpus, TODOS and reverse-engineering notes searched
on 2026-10-18. It fills the lane vacated by qualified Barrage; the coordinator
owns the rolling-pipeline ledger and runtime grants. Circus Linux owns the
build/native resource during this preparation.

The [publisher download page](https://www.newbreedsoftware.com/madbomber/download/)
identifies its Windows binary as version 0.2.5, supplied by Torsten Giebl, and
links directly to this original ZIP:

`https://tuxpaint.org/ftp/unix/x/madbomber/win32/madbomber-0.2.5-1.zip`

Archive: **2,957,899 bytes**, SHA-256
`f21ab59154fd434f0952daf84848af47bf50262b7317f2ca1dbf7f43cb213164`.
The HTTP Last-Modified header was 2003-12-31 21:36:47 GMT. This is the
publisher-linked precompiled Windows package, not a rebuilt source tree or
modern substitute. No installer or licence prompt was executed or answered.

## Original closure and evidence

Retained under `scratch/runs/20261018-madbomber-source/` in the coordinator
checkout: archive, `upstream.html`, `original/madbomber-0.2.5/`, `files.json`,
`closure.json`, eight `*.objdump.txt` reports, `verify.cjs`, and
`verification.json`. These ignored artifacts are not preserved by Git.

The ZIP has 154 entries: 140 files and 14 directories. All 140 original files
total **3,606,032 bytes**, including 126 data files. `unzip -t` passes; the
JavaScript verifier independently compares each extracted file against its
ZIP member and inventory size/hash. All 140 comparisons pass. Inventory
SHA-256: `555911f0a2a63285d3d0d386f6be2e658375e27172e22dd5f87ddab42ce9c013`.
Free space after preparation was 2,420,887,552 bytes; acquisition was admitted
only above 2 GiB + 128 MiB with a further 32 MiB reserve.

Original PE32 i386 modules:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| madbomber.exe | 19456 | `72ad26d11ddabf72c668b69eda0c7c1daa634f5cade631303ba4e05eb5f5cc09` |
| SDL.dll | 86016 | `55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410` |
| SDL_image.dll | 13824 | `50c505ec8e9586c7445d8b6da5c074ce5c2deec6099e94b259341b63d3389156` |
| SDL_mixer.dll | 122368 | `e48583f82cd4a503e6ed9097da51399b05e4c5b92e66566e3b180321c6647165` |
| jpeg.dll | 89571 | `37e38cee4955ee9a38e28b6f8bbde7c21b920dc14a518d39ca87004cc5f91131` |
| libpng1.dll | 47616 | `646ff9f1e5a050eb329c4554349c3a5b35eb86812b2f572211113d35db1314db` |
| zlib.dll | 27648 | `215d542025251e70a00ddc1cfa19fe00a7e5e24b67699e129fb8be0ff2972109` |
| msvcr70.dll | 164864 | `80ec1779b8026293d65598aa3b73e7491cde4a89450d09b333408a8fcd206b38` |

Static wrapper import closure:

- EXE: KERNEL32, msvcrt, SDL, SDL_image, SDL_mixer.
- SDL: KERNEL32, GDI32, MSVCR70, USER32, WINMM.
- SDL_image: KERNEL32, jpeg, libpng1, MSVCR70, SDL.
- SDL_mixer: KERNEL32, MSVCR70, SDL, WINMM.
- jpeg: KERNEL32, msvcrt. libpng1: KERNEL32, MSVCRT, zlib.
- zlib: KERNEL32, CRTDLL. MSVCR70: KERNEL32.

Every non-system module named by these wrappers is bundled. Preserve the
original MSVCR70 and all other DLL bytes. KERNEL32/GDI32/USER32/WINMM/MSVCRT/
CRTDLL names are emulator system dependencies, not missing redistributables.
The EXE is UPX-packed (entry RVA `0x16600`, base `0x400000`, GUI subsystem 4.0)
and its wrapper imports MSVCRT `_iob`. Several DLLs also expose packing-loader
imports. **This is not a complete runtime API closure:** dynamically resolved
imports remain unknown until the original packers run. Do not replace or
externally unpack the gameplay executable. Circus's CRTDLL `_iob` work does
not prove MSVCRT or dynamic GetProcAddress data-import compatibility here.

## Recovery recipe

In a fresh private directory, first require available disk space above
2 GiB + 128 MiB plus a 32 MiB acquisition reserve. Download the exact URL with
`curl -fsSL --max-time 45 --max-filesize 4194304 -o madbomber-0.2.5-1.zip URL`.
Verify the full archive SHA-256 above before extraction. Inspect `unzip -Z1`
for absolute/traversal paths, run `unzip -t`, then extract with
`unzip -q madbomber-0.2.5-1.zip -d original`. Keep the entire original
`madbomber-0.2.5` tree; no conversion or reconstructed configuration is needed.
Verify file count, byte total and all eight module hashes above. With the
retained run bundle, `node verify.cjs` also checks every original ZIP member.

## Next bounded validation, requiring a fresh runtime grant

Prepare one passive original launch with `madbomber.exe` as the entrypoint,
its own directory as guest working directory, all 140 files mounted at their
relative paths, and all seven bundled DLLs available to the real DLL loader.
`closure.json` records each guest-relative mount and original hash. The
upstream README explicitly says to launch beside the `data` directory.
Use no arguments or inputs for this first run; sound stays at its original
default. Plan 60 seconds guest wall guard, 65 seconds supervisor termination,
85 seconds absolute cleanup deadline; 8 MiB log cap, admission above
2 GiB + 128 MiB and stop below 2 GiB + 64 MiB. Refresh original/source/module
pins and disk admission immediately before the coordinator grants execution.
Use real calendar and real ticks without a fixed calendar pin. Capture the
initial loading/title screen, inspect it, record any first fail-fast API and
independently confirm the owned process group exits. No automatic retry.

Only after a reviewed title screen should a separate control plan select
ONE PLAYER using the documented menu arrows plus Enter/Space or a reviewed
mouse target. The original README documents Left/Right or mouse motion to
move the buckets, and Space/Enter/click to start bombs. A later bounded
gameplay qualification needs visible buckets responding to an ordinary
balanced input pair, bombs in play and a reviewed gameplay capture. Menu,
successful unpacking, or a screenshot alone is insufficient. Stop for any
unanswered licence prompt; no source patch, guest patch or substituted DLL
is authorized by this preparation.

## Guarded passive packet (2026-10-18)

`scratch/runs/20261018-madbomber-passive-prep/` holds `controller.js`,
`passive-plan.json`, `launch-manifest.json`, `current-pins.json`,
`pure-checks.cjs` and `pure-results.json`. It adapts the already-used Circus
passive controller, with this game's original directory and exact mounts.
All 140 mounts and seven real DLL seeds are checked against the original
inventory before launch; modified working directory, entrypoint, omitted
mounts or omitted seeds are rejected. MSVCR70 stays an original seeded DLL.
No conclusion about MSVCRT `_iob` follows from the separate CRTDLL change.

The packet targets the canonical CLI checkout `/tmp/wa-recovery-20261014`.
It refuses execution without the coordinator's exact per-run environment
grant and ready, nonempty source/module pins. Pins are intentionally marked
`awaiting-canonical-release`: no pre-rebuild module or source identity is
presented as current. Refresh them only after the coordinator releases its
canonical rebuild; rerun the original verifier and full packet preflight
before any separately granted execution.

The route uses no arguments or player input, real ticks/calendar without a
fixed wall-clock pin, explicit original mounts/seeds, `--no-build`, and the
60/65/85-second limits above. The child runs in an owned process group;
natural exit, controller signals and hard stops clean up that group, with
postflight source/original hashes and process inventory. Disk is polled every
250 ms; the 8 MiB log cap hard-stops, and licence/crash text requests a normal
quit. Scheduled 5/15/30/45/58-second captures are observations only. Separate
independent postflight remains required after the eventual real execution.

JavaScript syntax and pure checks pass: four disk-boundary cases, exact
140-mount/seven-seed closure, four altered-plan refusals, clock/limit flags,
missing-grant refusal before output creation, and unready-pin refusal.
These checks did not create a guest, build or browser. The actual timeout,
crash and process cleanup behavior remains to be observed in the granted run.
