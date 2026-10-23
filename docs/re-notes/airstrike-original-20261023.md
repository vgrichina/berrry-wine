# Airstrike pre6a original Win32 recovery — 2026-10-23

Authentic original archive recovered, but **dependency closure is blocked and no gameplay was executed**. No box was assigned, created, resumed or stopped. Future runtime lifecycle and shutdown remain coordinator-owned. No shared source, registry, dashboard or status file was changed. Base and strict-SSH remote-main reconciliation: `868e0440bdad4de2a364423da513aeb0b9e00e69`.

The [official icculus page](https://icculus.org/airstrike/) identifies Ulf Ekstrom's GPL 2D dogfight project, distinguishes unfinished development from its old playable preview, and links the exact Windows download below. This is not a modern same-name game. HTTPS acquisition used curl certificate validation, no redirects or alternate mirrors. These hashes identify the recovered bytes; they are not publisher signatures.

| Retained official artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [Win32 ZIP](https://icculus.org/airstrike/airstrike-pre6a-win32.zip) | 2,730,549 | `c611d1f269d2794920be7e715c40f251f93484b4ad00c399b4a9b8379aa2f662` |
| [Source tar.gz](https://icculus.org/airstrike/airstrike-pre6a-src.tar.gz) | 2,200,878 | `11232b4bbc760b261a3ae87441783ba5f327f15d37ec095a659ea0cbbed8d9c0` |

HTTP receipts/headers and the official page are adjacent evidence. Win32 response was 200 OK, Content-Length 2730549, Last-Modified 2004-05-03 12:42:51 GMT. ZIP has 167 entries, 162 files, 3,886,850 uncompressed bytes; CRCs passed during extraction. `files.json` records every individual file's path, size, compressed size, CRC32 and SHA-256, bound to the archive hash. Source declared file bytes total 2,868,537; only selected inspection text was extracted, with no compilation. `source-members.json` records its complete member inventory.

Release `LICENSE` says copyright 2001–2003 Ulf Ekstrom and contributors, program and most data GPL; `COPYING` supplies GPL version 2 text. It separately describes some internet sound files as believed public domain. This is the release author's qualification, not independently established sound provenance. Bundled support DLLs retain their own licenses; do not infer GPL coverage for Microsoft CRTs or all DLLs from the game license.

`pe.json` records all seven shipped PE32 images, full import symbols (names/hints and ordinal imports), complete export tables/forwarders, machine, base, entrypoint, versions and hashes. All have machine `0x014c` (i386). EXE is 143,360 bytes, preferred base `0x00400000`, entry RVA `0x1138e`, entry VA `0x0041138e`, Windows GUI subsystem. Its static imports are SDL.dll, SDL_mixer.dll, SDL_image.dll, MSVCR70.dll and KERNEL32.dll. Delay-import directories were recorded; static analysis does not inventory every possible dynamic load.

| Bundled DLL | Bytes | Embedded file version |
| --- | ---: | --- |
| SDL.dll | 229,376 | 1.2.7.0 |
| SDL_image.dll | 36,864 | 1.2.3.0 |
| SDL_mixer.dll | 270,336 | 1.2.5.0 |
| jpeg.dll | 169,443 | none observed |
| libpng1.dll | 94,720 | 1.0.8.0 |
| msvcr70.dll | 307,200 | 7.0.9064.0 |

`dependency-comparison.json` traverses shipped imports and the standing read-only MSVCRT donor, compares exact names/ordinals to PE exports, and compares remaining system names to the standing `src/api_table.json` identity. It found no unresolved imports between available PE providers. MSVCRT.dll is not bundled: standing `test/binaries/dlls/msvcrt.dll` supplies it, with identity and recursive imports retained in the comparison. This donor remains in place; no copy was staged.

The concrete missing binary is **zlib.dll**: bundled libpng1.dll imports ordinals **10, 3, 7, 6, 4, 20, 22, 19, 23**. It is absent from the exact release and standing DLL directory. A bounded filename inventory under existing test/binaries, packages and scratch/usage-watch found only unrelated Dredmor `zlib1.dll` files, not zlib.dll. They were neither copied nor relabeled; filename similarity cannot establish the required ordinal ABI. PNG assets are required at startup, so this dependency cannot be dismissed as optional audio. Observable resume condition: coordinator supplies an authorized, provenance-checked zlib.dll whose ordinal exports match this libpng build, or assigns a separate dependency repair task.

Other static gaps against the system API name table: SDL.dll→WINMM.waveOutGetErrorTextA; SDL_mixer.dll→WINMM.midiStreamStop; msvcr70.dll→KERNEL32.IsDBCSLeadByteEx. Standing MSVCRT exports satisfy longjmp/gmtime and related CRT imports; these must not be classified as missing merely because they are absent from the emulated API table. DirectSound/DirectDraw or other LoadLibrary/GetProcAddress paths are possible and remain unverified. Name-table presence does not prove implemented semantics or runtime success.

The standing DLL registry admits SDL.dll and MSVCRT.dll but not SDL_image.dll, SDL_mixer.dll, jpeg.dll, libpng1.dll or msvcr70.dll. A future ad-hoc launch must explicitly seed all six bundled DLLs plus the MSVCRT donor; merely placing DLLs beside the EXE is insufficient. No registry change was made.

The minimal conservative game VFS uses `C:\\` as working directory and contains `airstrike-pre6a.exe`, `airstrikerc`, and **every `data/**` file at its exact archive-relative path after stripping `airstrike-pre6a/`**. The corresponding exact hashes/paths are in `files.json`; no POV-Ray files, ChangeLog or rendering tools are needed for play. Mount/load the six DLLs, standing MSVCRT and future verified zlib as well. `datapath "data"` is relative; source additionally hardcodes `data/bg.png` and `data/bgmask.png`. Missing config terminates setup. Defaults: 800×600 window, alpha 2, one human against AI, sound 1. Configuration reads `airstrikerc`, then `$HOME/.airstrikerc` if HOME exists. Avoid an unintended HOME overlay. No installation, registry key or mandatory save is indicated by inspected source. Optional `S` writes `screenshot.bmp` in CWD; use the harness PNG capture instead. Menu changes appear in memory; no config writer was observed in inspected paths.

Source-backed controls (`src/players.c`, `src/airstrike.c`, references retained): press any key at introductory text to begin. Player 1: comma accelerates, Left/Right turn, period fires, Space is special/bomb action. Player 2, when enabled through Escape→Players setup: Left Ctrl accelerates, D/F turn, Left Shift fires, Tab special. Escape opens the menu; arrows navigate and Return selects. Initial player 1 is Blue Baron and player 2 is AI by default. Hold acceleration/turn/fire across multiple rendered frames; acceptance requires visible player-plane trajectory change and emitted projectiles, not just the startup text or background animation. Source archive is corroborating release context, not proof of an exact source-to-EXE build correspondence.

The following is the next concrete acceptance recipe **only after missing zlib and coordinator runtime admission are resolved**, on a coordinator-assigned box with an existing qualified wasm. It has not been executed. It must receive its own arena/memory/disk/capture admission; the current task authorizes no Node, wasm instantiation or guest execution. Paths below refer to the retained host closure and must be transferred/adjusted on that box. Do not run the harness's auto-build fallback: verify the prebuilt file exists before invocation and retain its SHA-256.

```bash
cd /home/user/wine-assembly
AIRSTRIKE=/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a
# Set QUALIFIED_WASM to coordinator-qualified existing wasm, VERIFIED_ZLIB to
# the separately verified missing DLL, and RUN to a fresh scratch/runs/<id>.
test -s "$QUALIFIED_WASM" && test -s "$VERIFIED_ZLIB" && test -d "$RUN" &&
node test/run.js --no-build --wasm="$QUALIFIED_WASM" \
  --exe="$AIRSTRIKE/airstrike-pre6a.exe" \
  --dlls="$AIRSTRIKE/SDL.dll,$AIRSTRIKE/SDL_image.dll,$AIRSTRIKE/SDL_mixer.dll,$AIRSTRIKE/jpeg.dll,$AIRSTRIKE/libpng1.dll,$AIRSTRIKE/msvcr70.dll,/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll,$VERIFIED_ZLIB" \
  --vfs-include='airstrikerc,data/**/*' --cwd='C:\' \
  --quiet-api --no-threads --max-seconds=30 --max-batches=2000 \
  --batch-size=20000 --tick-ms-per-batch=5 \
  --input="30:keypress:13,100:keydown:188,150:keydown:37,180:keydown:190,250:png:$RUN/movement-fire.png,350:keyup:37,400:keyup:190,450:keyup:188,500:png:$RUN/after.png" \
  --png="$RUN/final.png"
```

Input batch timings are unverified starting assumptions; move inputs only after observing the startup gate and actual frames. Preserve bounded stdout/stderr with the coordinator's capture wrapper. Inspect movement/fire captures and write ops result.json last with actual revision, wasm identity, route/environment and unknowns. Failure acceptance is a specific first loader/API/opcode fault with bounded log; success is observed gameplay and input response. No app was registered.

Resource checkpoint `allocation.json` passed **before acquisition**: projected peak NEW 56,623,104 bytes including private Git/index, original archive, extraction, source inspection, temporary/evidence bytes, current/future Codex and external launcher logs and 8,388,608 reserve, below 67,108,864. Host free 4,385,374,208 minus full projection = 4,328,751,104, above 2,982,150,144. Installed Python/Git/curl/objdump identities and standing footprints are separate; shared object store is read-only via private Git alternates, never copied. The root checkout remains dirty and untouched apart from append-only board messages.

**Guard stop:** after the custom static parser completed, an independent `objdump -p` cross-check captured six outputs totaling 513,593 bytes. Capturing the seventh (msvcr70.dll) exceeded the aggregate 524,288-byte limit and raised the explicit assertion. The seventh output was not retained. This ad-hoc cross-check checked the total after capture, so it did not prevent the over-capture; it is not a compliant full cross-check. Inspection stopped immediately, with no retries, game substitution, dependency acquisition or runtime. The VFS-generation stage following that assertion did not execute; `files.json` remains the complete asset inventory. Existing partial disassembly evidence is retained and labeled partial. Exact rejected total is unavailable because the failed subprocess buffer was not persisted. Future inspection must enforce a streaming remaining-output budget before capture. Final recovery-script hash assertions were added during preservation review and were not rerun after this stop.

Retained ignored originals and extraction: `/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/`. They are outside Git and are **not remotely backed up**. The committed bounded `recover.py` and expected hashes allow reacquisition in an empty evidence directory using `timeout 60s python3 recover.py win32`, `source`, then `extract`; `page` is optional mutable provenance. It refuses overwrites and checks exact archive identity, ZIP aggregate size, safe paths and CRCs. `inspect.py` reproduces custom PE/dependency evidence without executing a guest. Publication retains reports/manifests/recipes/HTTP evidence and partial objdump text, not executable or source archive bytes. No native compilation or wasm instantiation occurred.
