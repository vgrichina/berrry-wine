# Original KKnD Windows Xtreme demo payload recovery, 2026-11-06

The media prerequisite for `NEW-GAME-KKND-DEMO-20261106` is ready. The original Windows Xtreme demo is recovered at `scratch/game-media/kknd-demo-20261106/installed/`: **16 files, 15,653,500 bytes**, including the unmodified `KKND.EXE`. This was static recovery and validation only; no installer, game, emulator, Chrome, benchmark, shared build, boxes, or guest modifications ran. Gameplay and runtime compatibility remain untested.

Evidence: `scratch/runs/20261106-kknd-payload-recovery/`. `payload-manifest.json` gives every installed relative path, size, SHA-256, CRC32, cabinet index, offset, compressed size and chunk count; `payload-SHA256SUMS` is directly usable with `sha256sum -c`. `recovered-media-manifest.json` covers all **31** retained files: 15 installer inputs and 16 game files. Media bytes stay outside evidence. Run-owned helpers and their new-file patches are retained there; no canonical helper, tests or `lib/apps.js` were changed.

## Source and complete outer recovery

Source remains `scratch/runs/20261106-kknd-corpus-intake/KKND_XT.EXE`, 7,737,611 bytes, SHA-256 `b0974e129ab1c02d4fdf7cd202494f39f426a1e08cbd37759db125a9a114248d`. Recovery download: `https://archive.org/download/KKNDXT/KKND_XT.EXE`. See [corpus intake](kknd-corpus-intake-20261106.md) for provenance and the separate DOS demo. No second source download or media copy into evidence was made.

The prior `20261106-kknd-original-demo/recover-outer.py` was an unexecuted draft. Inspection found three assumptions that reject the intact original:

- Each local ZIP header has flags `2`, but its central header has flags `0`.
- Central disk-start is `1`; each EOCD has disk numbers `0`, one entry, and archive-relative offsets.
- Between each complete ZIP and the next local header is a 47–51 byte executable wrapper record; the final ZIP ends exactly at EOF.

The run-owned corrected `recover-outer.py` accepts these exact legacy writer fields. The wrapper starts with a little-endian length equal to wrapper bytes minus 12, followed by the fixed 27-byte marker `f854f1ef104fb6f368451c9e685398eb6e89b548a867acf36f96f1`. Remaining wrapper bytes are opaque; the whole source SHA-256 pins them, and per-wrapper hashes/offsets are in `outer-validation.json`. This is a bounded parser for this exact source, not a generic ZIP repair utility.

All **15** members pass local/central/EOCD consistency, bounds, unique safe names, exact counts and offsets, bounded raw-deflate stream termination, expanded size, CRC32, and inventory SHA-256. Every complete ZIP was also read independently with Python `zipfile`, producing identical bytes. `test-outer.py` rejects **273** damaged cases, including each member's local fields, deflate data, central fields/names/disk/offset, EOCD count/size/offset/comment, wrapper framing, independently exercised expanded CRC/size/SHA checks, truncation and source hash. Normal and `python3 -O` checks pass; validation uses explicit exceptions rather than removable assertions.

Recovered installer inputs under `installer/`: `os.dat`, `_ISDEL.EXE`, `SETUP.EXE`, `lang.dat`, `_INST32I.EX_`, `_SETUP.DLL`, `setup.ins`, `_sys1.cab`, `setup.bmp`, `DATA.TAG`, `SETUP.INI`, `_user1.cab`, `layout.bin`, `data1.cab`, `setup.lid`. Their sizes/hashes are in `installer-manifest.json` and `outer-validation.json`.

## Actual cabinet and installed layout

`data1.cab` is InstallShield 5, common version `0x01005100`, 6,991,887 bytes, SHA-256 `e918ae3cf70772599eb378fb5ec7f42772fd8f57b438e7aba9931d9b925333f9`. Its catalog has 18 descriptors: two invalid directory placeholders (indices 2 and 3) and 16 real files. Three groups cover the complete demo: `Program Executable Files` (0–1), `Game Levels` (2–7), and `Multiplayer Levels` (8–17). Group names are installer categories, **not installed directory names**. All groups must be merged preserving the catalog's relative directories.

Installed `unshield` 1.5.1 lists the cabinet correctly, but extracts only 14 files. Both program files have flags `6`, whose misleading obfuscation bit breaks unshield: README's first chunk is misread as length 28,704 and attempts nonexistent volume 2; the executable's first chunk fails deflate with `-3`. Neither failure proves missing media. The existing `tools/is5-extract.js` handles the actual early IS5 layout and recovered all 16 files without changing source or media. `unshield-debug.log`, `unshield-list.log`, `unshield-extract.log`, `cabinet-catalog.json`, and `is5-extract.log` record the boundary.

The independent run-owned `verify-payload.py` reparses the descriptor/directory table, skips the two invalid descriptors before dereferencing their invalid name pointers, checks contiguous data ranges through exact cabinet EOF, and strictly inflates **1,537** length-prefixed raw-deflate chunks. Every chunk terminates with no unused or unconsumed bytes and expands to at most 10,240 bytes; every assembled file matches its descriptor size and the actual installed bytes. All 14 successful unshield outputs matched byte for byte (`unshield-comparison.json`); redundant comparison trees were then removed. Another **48** truncated, overlong and invalid chunk-length cases reject. There is no remaining format limitation for this payload.

`KKND.EXE` is a 465,408-byte i386 PE32 Windows GUI image, preferred base `0x400000`, entry `0x4545a0`, linker timestamp 1997-08-21 01:47:11 UTC. It imports system `DDRAW.dll`, `DSOUND.dll`, `DPLAYX.dll`, `WINMM.dll`, `KERNEL32.dll`, `USER32.dll`, `GDI32.dll`, `ADVAPI32.dll`, and `VERSION.dll`; there are no shipped companion DLLs in the game catalog. The README specifies DirectX 5 and four single-player missions, two each for Survivors and Evolved. The only mission files supplied are `SURV_16`, `SURV_17`, `MUTE_16`, and `MUTE_17`; other mission names in the executable are not missing demo assets. The README marks multiplayer/KAOS as full-version features despite the installer's `Multiplayer Levels` group name.

Complete installed files follow; paths are relative to `installed/` and case must be retained on the host filesystem.

| Relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `KKND.EXE` | 465408 | `b2e1a476bfe766edf802c9fa4d0fed2ed841a8d1b50e1a8ee27ceae33afe5d8a` |
| `LEVELS/640/FMV.LVL` | 19525 | `9f12bdbfd42a886de9d1bd32aab4c0310af26f4d9499b714f4c5bcd173020c06` |
| `LEVELS/640/MUTE_16.LVL` | 1075504 | `19b841e39d9978ab849fb2e3cb1f5b72c6c9a16efd4a0406c27b1aea12a884ed` |
| `LEVELS/640/MUTE_17.LVL` | 617441 | `85d4d8192d7ce6cbcb174488e0cb59830a5b4c8b0954ce95f24b92251fa35ca7` |
| `LEVELS/640/SPRITES.LVL` | 4861312 | `35786c9e5514355cd857a1f6d86c4f96248a713ad8322fecd5b0da18e52bedd4` |
| `LEVELS/640/SUPER.LVL` | 1598983 | `641fc72c5bba091dafb7a5d91d3bf108344f333006e8968497afd45f1ac3097c` |
| `LEVELS/640/SUPSPR.LVL` | 720519 | `9861b2f57cdf76e9f7dd78ee9ceddde703184bc29421f74eb95c1030bd09df9f` |
| `LEVELS/640/SURV_16.LVL` | 1228008 | `88f2728652921e15369b46dd91c13f3b75448035734e2ad59161febc955a82f8` |
| `LEVELS/640/SURV_17.LVL` | 741131 | `7a189f43582bdad503708f45b7ec92f4736cb0d01ff610fde502b955f67787f5` |
| `LEVELS/640/WAIT.LVL` | 217089 | `d717f6b84c18ff2cbb92cc7c4b593c9599003a84fd441bc3305d241496e02363` |
| `LEVELS/MULTI.PAL` | 2844 | `3bfbadc78ced91231e5a9897d6cbe6c344a9011969715a9173d2cdd41a4d987a` |
| `LEVELS/MUTE.SLV` | 2043946 | `bac2de891bf0da6edcf37446ffc68445eb06e8ab4e11bf27ad4de83c8d131b80` |
| `LEVELS/SUPER.SLV` | 19516 | `f94376ffa32b0cfca3ca0975d8b5766631f3c159698b79de2691b5f38d3935a8` |
| `LEVELS/SURV.SLV` | 2019060 | `1b0dbcbf7d8c6cbaaf135e1d745e84a19c1e3c4a3ea2c6d7f4dad95d2d5627c1` |
| `README.TXT` | 16126 | `b814f64adb4ae9a84b962a762c241e934efc9019559f173b0b7b3f44ad1c9c13` |
| `UNITS.CFG` | 7088 | `625359622141e907a8076069d6804859828bb3de0aebd0d312b9ed92a3f9c722` |

## Installation and registration recipe for the next lane

For a normal installation, static `setup.ins` strings identify `C:\KKNDXtreme Demo` as the default destination. Choose Typical/FULL to include all demo levels; Compact installs only the multiplayer group. DirectX is a system prerequisite; do not copy installer support files, `_sys1.cab` or `_user1.cab` into the game directory. For the emulator lane, the fully extracted game tree replaces the installer's file-copy step.

The game at `0x422e10` initializes its asset base to `.` (string at VA `0x4634a8`). At `0x422e55`–`0x422e5f` it opens **HKLM** (`0x80000002`), `SOFTWARE\Melbourne House\Krush, Kill 'n' Destroy Xtreme Demo\1.00.000`, with `KEY_READ` (`0x20019`). At `0x422e7d`–`0x422e8b` it queries **`GamePath`**, using a 256-byte buffer at `0x475398`. Missing key/value leaves the `.` fallback. This is directly supported by original disassembly, not an inferred installer company name. For a conventional installation, set that value as `REG_SZ` to the actual target directory; for the existing root-mounted emulator pattern, set it to `.` with CWD `C:\`. Level lookups then resolve `'.\LEVELS\640\wait.lvl'`, `sprites.lvl`, etc. No other registry lookup is imported or called by this executable. No fabricated serial, CD key or binary patch is required by the observed startup path.

A prepared **host metadata proposal**, `registration-manifest.proposed.json`, contains schemaVersion 1, all 15 companion mappings (`installed/<relative>` to `c:\<relative>`, with size), and the correctly encoded storage snapshot:

```json
{
  "reg:HKLM\\SOFTWARE\\Melbourne House\\Krush, Kill 'n' Destroy Xtreme Demo\\1.00.000":
    "{\"values\":{\"GamePath\":{\"type\":1,\"data\":\".\"}}}"
}
```

The object above is the manifest's `registry` field; `type: 1` means `REG_SZ`. This follows `tools/gen-simcity2000-manifest.js`'s `reg:<key>` → JSON-string storage shape. `lib/browser-shell.js` imports `local.registry` before guest code; `test/run.js` does the same. `check-registration.cjs` verifies all proposal URLs/sizes/hashes and resolves every `GamePath`-relative companion to its proposed VFS identity using the existing `VirtualFS` path parser. It checks the executable's PE identity as well; it does not execute guest code.

For the next source-owning worker, place the proposed manifest at the media root as `.wine-assembly-browser.json` (URLs are relative to that root), then follow the existing `pharaoh_demo`/`heretic2_demo` entries in `lib/apps.js`:

```js
const kkndXtremeDemoRoot = 'scratch/game-media/kknd-demo-20261106/';
// In the app entry object:
kknd_xtreme_demo: {
  exe: kkndXtremeDemoRoot + 'installed/KKND.EXE',
  files: [],
  localFileManifest: kkndXtremeDemoRoot + '.wine-assembly-browser.json',
  requiredFiles: true,
  fileConcurrency: 10,
  touchControls: mouseStrategyTouch({ scroll: true }),
},
```

Also add `['kknd_xtreme_demo', 'KKnD Xtreme Demo', '\u{2694}']` to the existing games category list if ordinary menu launch is desired. This is a registration **proposal**, not an applied production edit or tested touch-control configuration. A permanent corpus location can replace the root constant without duplicating media; keep manifest URLs relative to that root. Existing `localFileManifest` handling resolves them relative to the manifest in both browser and CLI. There are no shipped DLLs to add to `dlls`; system DirectX imports use the emulator's existing DLL/API route. Leave resolution, threads and memory overrides at defaults until measured. `UNITS.CFG` and every other shipped file remain byte-identical.

After registration and its required focused checks/locked build, execute the ordinary lane with `--app=kknd_xtreme_demo` or its browser menu entry. Inspect original startup/menu first, then select the Evolved first mission “Walkover” recommended by the README and establish unit selection/movement. README controls include left-click select/move, right-click deselect/fast scroll, arrows scroll, Enter/Space select menu options, Esc return/menu. These are intended next steps, not gameplay results from this run. Runtime ordering and ownership remain with the coordinator.

To reproduce recovery into a **new, absent** media destination (the retained destination already exists and must not be overwritten):

```sh
python3 scratch/runs/20261106-kknd-payload-recovery/test-outer.py
python3 scratch/runs/20261106-kknd-payload-recovery/recover-outer.py NEW_MEDIA_ROOT/installer
node tools/is5-extract.js NEW_MEDIA_ROOT/installer/data1.cab --out=NEW_MEDIA_ROOT/installed
```

For the retained tree, rerun `verify-payload.py` and `check-registration.cjs`, or run `sha256sum -c /home/user/wine-assembly/scratch/runs/20261106-kknd-payload-recovery/payload-SHA256SUMS` from `installed/`. The independent verifier defaults to the retained path; the unshield cross-comparison is already preserved and only reruns when its temporary comparison tree exists.

The DOS demo remains separately identified at `scratch/runs/20261106-kknd-corpus-intake/kknd-demo.ZIP`, SHA-256 `7ff2ef0abe45322027750cee26caf871d970474d92d98272598ab15426cc0be4`; its 1,059,993-byte DOS/4G `KKND.EXE` is not this PE or this registration. No DOS files were mixed into the Windows payload.

Source evidence pins the initial checkout at `570c67b16dfff9968d634861b7717e9546f31c2a`; `source-state.json` records final inspected source/helper hashes and `git diff --binary` evidence. `owned-new-files.patch` preserves the run-owned helpers and this note without archiving the source tree. This publication changes documentation only; no shared build is required. No owned runtime processes, ports, browser profiles, build locks or boxes exist to hand back; box ID/state/expiry: N/A, none assigned or used.
