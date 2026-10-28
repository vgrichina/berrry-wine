# Tux Racer retained original media: integrated static validation

2026-10-28: **PASS for the production tool's static closure scope only.**
No installer, Tcl script or game was executed. Dynamic Tcl, runtime loading,
renderer, gameplay and ordinary Quit remain unqualified.

The real retained original ZIP and existing extraction were checked against
integrated main `ac4fdeb31c20d5bd869f201c9c051ad5bc663ca6`.
The unchanged production API was imported from
`tools/recovery/tuxracer-original-win32-recovery-oct28.py`, 20,631 bytes,
SHA-256 `567a716c33e97d9c8547a02c77ff10dc1839308afb45c3fe9848effb60a3134d`.
The actual acceptance call was `tool.closure(directory, inventory)` after
verifying the real inputs; no historical tool or assembled surrogate was used.

## Inputs and checks

All paths below are read-only inputs under
`/home/user/wine-assembly/scratch/usage-watch/`:

| Input | Relative path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Original ZIP | `tuxracer-original-win32-recovery-oct28/payload/tuxracer-win32-0.61a.zip` | 8,009,319 | `1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34` |
| Inventory | `tuxracer-retained-original-closure-oct28/payload/inventory.json` | 29,710 | `9ac1ac56933cbeae45b0ada2162af298dbc768a5f82a0e2131faa218b0644dc5` |
| Canonical dispatch | `tuxracer-integrated-original-media-validation-oct28-dispatch.json` | 1,614 | `b44b041779b4c0bc303edcb23428f2f311937c4a61c850cafbcf397022251c7f` |

Existing extraction:
`tuxracer-retained-original-closure-oct28/payload/extracted`.
The recipe ignores predecessor `complete` and CRC claims. It stream-checked
all **158 files / 13,225,945 expanded bytes** against inventory sizes and
SHA-256, then read each original ZIP member stream fully, checking ZIP CRC
and the same size/hash. Archive, inventory and extracted file paths correspond
exactly; directory entries exist, and symlinks/special extracted files reject.
The production `pin()` and `metadata()` checks passed: **180 ZIP entries**,
**17,085 metadata bytes**, and **13,225,945 expanded bytes**. No payload was
downloaded, copied or re-extracted, and no predecessor payload census was rerun.

## Production closure result

All four modules were validated as i386 PE32 with no unresolved non-system
direct imports and no indicated delay-import directories:

| Module | Bundled direct dependencies | Windows-classified imports |
| --- | --- | --- |
| `tuxracer.exe` | `sdl.dll`, `sdl_mixer.dll`, `tcl83.dll` | `glu32.dll`, `kernel32.dll`, `opengl32.dll` |
| `SDL_mixer.dll` | `sdl.dll` | `kernel32.dll` |
| `SDL.dll` | none | `gdi32.dll`, `kernel32.dll`, `msvcrt.dll`, `user32.dll`, `winmm.dll` |
| `TCL83.DLL` | none | `advapi32.dll`, `kernel32.dll`, `msvcrt.dll`, `user32.dll` |

Windows classification is the tool's static allowlist; this does not prove
those APIs are implemented or correct in Wine Assembly.

The tool inventoried **154 non-PE data files**, including `COPYING.txt`, and
checked **six recognized literal Tcl source references**:

- `tuxracer_init.tcl` → `courses/course_idx.tcl`.
- `courses/common/courseinit.tcl` → `tree_polyhedron.tcl`, `tux_walk.tcl`,
  `sunny_light.tcl`, `foggy_light.tcl`, `night_light.tcl`.

Two expressions remain explicitly unknown: the computed
`"$tux_data_dir/courses/common/courseinit.tcl"` and parent-relative
`../common/tux_walk.tcl` in `courses/common/tux_moonwalk.tcl`.
The tool checks its recognized lexical subset against root/script-directory
candidates. It does not establish all Tcl/data dependencies or runtime CWD.
All retained data bytes match the archive, but general resource loads, computed
Tcl and unrecognized command forms remain outside this closure proof.

Meaningful rejecting controls passed without modifying originals:

1. A one-entry altered inventory containing only the real executable rejected
   missing `sdl.dll`, `sdl_mixer.dll`, and `tcl83.dll` as unresolved imports.
2. An owned 19-byte `init.tcl` fixture containing `source missing.tcl` rejected
   with `missing literal Tcl source: init.tcl -> missing.tcl`.

The six unchanged accepted source tests are reused from the integrated-main
acceptance receipt, not repeated:
`scratch/usage-watch/tuxracer-accepted-static-closure-main-integration-oct28/receipt.json`
and its `acceptance` / `pins` records. The accepted six-method test source hash is
`02cde9af35fa4bc64ab1ca48d09c3d38d32bd6472057f99829bb5ab6fa6abfbe`.
Production source and all inherited test pins were checked at the exact base.

## Reproduction and evidence

From a checkout containing this recipe and the pinned production source, under
the task's external resource supervisor, use a **new** owned output directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 \
  test/test-tuxracer-integrated-original-media-validation-oct28.py \
  /home/user/wine-assembly/scratch/usage-watch/tuxracer-integrated-original-media-validation-oct28-dispatch.json \
  /tmp/tuxracer-integrated-original-media-validation-repeat
```

This imports only static host Python parsing; it does not use `extract`,
`publish_extract`, `download` or any runtime command. Failure leaves the input
checkpoint and causal closure rejection in the new output directory, returning 2.
Output creation is exclusive, so prior evidence cannot be overwritten.

Actual new evidence root:
`/tmp/tuxracer-integrated-original-media-validation-oct28/`.
`real-input-output/` contains `input-verification.json`, `closure.json`,
`controls.json`, and `result.json`. `real-original-check.json` records the exact
command, exit 0, 0.28 seconds and sampled peak process-tree RSS 22,835,200 bytes;
stdout/stderr were retained separately. The canonical `receipt.json` binds
these artifacts, resource admission, remote publication and cleanup. The owned
supervisor applies Python DATA 128 MiB, Git-only DATA 256 MiB, physical RSS
128 MiB/process and 512 MiB/tree, CPU 90s, wall 120s, file 12 MiB and capture
2 MiB/stream. No Node or Boat was needed.

No original binaries are committed. Only this report and the validation recipe
are task changes; main, registries, public deployment and donor evidence are
outside the write scope. Board publication is handed to the coordinator using
`publication-note.txt` because the standing board exceeds the worker file cap.
