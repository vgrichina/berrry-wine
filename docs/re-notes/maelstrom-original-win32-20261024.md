# Maelstrom 3.0.6: original Win32 acquisition and static closure

The authentic historical Windows distribution is retained and its packaged dependency/data closure passes. This is a static prerequisite for a later coordinator-assigned runtime task. No PE was executed, no emulator compiled, no browser or box used, no registry entry added, and no gameplay claim made.

Base: `f6571101e38985b3fa34d328f2ccadd9735a7573`, verified against the immutable donor and actual strict-SSH remote main before edits. Maelstrom is absent from that revision's `lib/apps.js` and `TODOS.md`. This task branch does not merge main.

## Original bytes and provenance

The [author's historical binary page](https://slouken.libsdl.org/projects/Maelstrom/binary.html) explicitly lists **Maelstrom 3.0.6 for Windows 95/98/ME/NT/XP/Vista** and links the recovered archive. The [historical main page](https://slouken.libsdl.org/projects/Maelstrom/) identifies Sam Lantinga and SDL/SDL_net. Current GitHub releases and the current libsdl release directory list modern 4.x builds; none were acquired or substituted.

| Artifact | Retained bytes | SHA-256 |
|---|---:|---|
| [Maelstrom-3.0.6-Windows.zip](https://slouken.libsdl.org/projects/Maelstrom/bin/Maelstrom-3.0.6-Windows.zip) | 906220 | `6cc9ef78eda9a0c3591dbd6f67b8c534682ef3f30bda0acd3b0138a0a0c52db5` |
| [Maelstrom-3.0.6.tar.gz](https://slouken.libsdl.org/projects/Maelstrom/src/Maelstrom-3.0.6.tar.gz), reference source only | 1013073 | `e7983c2c7376cdcca1944db1706d92aedd529638cf13358c88a60df982ba7b46` |

These are direct author-hosted HTTPS acquisitions, locally digest-pinned. No publisher signature or independently published digest was found; the recorded digests identify the bytes recovered, rather than asserting signed provenance. The source archive was inspected selectively and never compiled.

The ZIP's `COPYING.txt` identifies GPL code and requires its Ambrosia artwork/sounds to accompany the complete public GPL release. `COPYING.GPL.txt` contains GPL version 2. `README-SDL.txt` identifies SDL's LGPL distribution and source site. The ZIP retains both required documents, `Docs/Ambrosia_Software,_Inc._FAQ.txt` and `Docs/MaelstromGPL_press_release.txt`, plus the license files. Preserve the whole distribution and its notices. The currently hosted reference source has a newer CC-BY artwork notice; this report records the original Windows package notice without replacing it.

Private retained originals, **not Git-backed**:

```
/tmp/maelstrom-original-win32-closure-oct24/archives/Maelstrom-3.0.6-Windows.zip
/tmp/maelstrom-original-win32-closure-oct24/archives/Maelstrom-3.0.6.tar.gz
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/
```

The archive expands to **2794170 bytes**, 48 files, under `Maelstrom-3.0.6/`. Compressed plus extracted overlap is **3700390 bytes**, admitted before extraction. The [manifest](maelstrom-original-win32-20261024/manifest.json) records every archive entry and every extracted file's size and SHA-256. [Retrieval receipts](maelstrom-original-win32-20261024/retrieval-receipts.json) retain requested/final URLs, HTTP headers, bounded sizes and hashes.

## PE and recursive packaged DLL closure

All three modules are original i386 (`0x014c`), PE32 (`0x010b`). The EXE is a GUI subsystem image linked with MSVC 6, timestamp **2002-10-21 16:24:09 UTC**, with relocation directory absent.

| Module | Bytes | Image base | Entry RVA / VA | SHA-256 |
|---|---:|---|---|---|
| Maelstrom.exe | 135168 | `0x00400000` | `0x17474` / `0x00417474` | `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5` |
| SDL.dll | 225280 | `0x10000000` | `0x298df` / `0x100298df` | `02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373` |
| SDL_net.dll | 24576 | `0x10000000` | `0x1e4f` / `0x10001e4f` | `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95` |

The shared preferred DLL base requires normal PE DLL relocation. The checker traverses imports from the EXE recursively. Its 41 SDL imports and 16 SDL_net imports, plus SDL_net's one SDL import (`SDL_SetError`), all bind to actual named exports: **58 packaged symbol bindings**. Named and ordinal export aliases are inventoried; forwarders are resolved recursively or rejected. These originals have no forwarded exports or delay imports. Hashes and complete parsed PE observations are pinned, not merely DLL filenames.

An independent installed GNU `objdump -p` check agrees on i386 format, all entry RVAs, module import ordering, and the 177 SDL / 33 SDL_net named exports; [independent-pe.json](maelstrom-original-win32-20261024/independent-pe.json) records output hashes. Full bounded output remains private, including SDL's relocation inventory.

The explicit external Windows system boundary is:

| DLL | Distinct imported symbols across the closure |
|---|---:|
| KERNEL32.dll | 23 |
| USER32.dll | 57 |
| GDI32.dll | 21 |
| WINMM.dll | 16 |
| WSOCK32.dll | 21 |
| MSVCRT.dll | 64 |

All 202 names and each module's imports are in the manifest. The static check does **not** establish their emulator implementation or behavior. No non-system DLL artifact is missing. The original SDL binary also contains `DSOUND.DLL`, `DDRAW.DLL`, `DINPUT.DLL`, and `OPENGL32.DLL` loader-name strings, inventoried with exact offsets in [dynamic-dll-strings.json](maelstrom-original-win32-20261024/dynamic-dll-strings.json). These are potential backend requirements, not a complete dynamic call graph. A runtime task must observe selected video/audio/input backends and any actual dynamic loads.

## Assets and exact launch/data mapping

Map the entire original directory to **`C:\maelstrom`**, preserving names and the `Images` and `Docs` subdirectories. Use:

```
executable: C:\maelstrom\Maelstrom.exe
working directory: C:\maelstrom
command line: Maelstrom.exe
environment: MAELSTROM_LIB=. ; HOME=.
DLLs: original SDL.dll and SDL_net.dll beside Maelstrom.exe
```

The default source path requests a 640x480 SDL software surface and no fullscreen flag. Do not use `-netscores`, `-player` or `-server` for the initial single-player qualification. `P` is the source-defined main-menu start action; consumption and gameplay still need runtime evidence.

`LibPath` uses `MAELSTROM_LIB`, with the Win32 default `.`. `Open_MacRes` tries literal resource names and then substitutes spaces with underscores. Therefore keep the packaged **`Maelstrom_Fonts`**, **`Maelstrom_Sounds`**, and **`Maelstrom_Sprites`** filenames unchanged; do not fabricate renamed files. Their raw Mac resource forks validate and contain:

- Fonts: 3 FOND, 2 sfnt, 12 NFNT resources.
- Sounds: 35 `snd ` and 2 vers resources.
- Sprites: 117 ics8, 116 `ics#`, 523 `ICN#`, 523 icl8, 2 vers, 1 PICT resources.

The manifest enumerates every resource ID and all **26** `Images/*.bmp`/`*.cicn` containers with validated dimensions. `icon.bmp` and `Maelstrom-Scores` are also retained. Scores write through `MAELSTROM_LIB`; controls use `HOME/.Maelstrom-data`, falling back to the current directory. The absent `.Maelstrom-data` is deliberate initial state, generated by the game. Future runtime writes need a writable guest filesystem and should be retained separately from the pristine closure used by the verifier.

[Source path proof](maelstrom-original-win32-20261024/source-path-proof.json) binds exact selected source-member hashes, byte-exact line excerpts, resource opening, path selection and initialization. [Source/data comparison](maelstrom-original-win32-20261024/source-data-binding.json) finds 29 of 30 comparable assets identical; the source archive's `Images/Maelstrom_Titles#999.bmp` differs. The checker pins the **Windows ZIP's** original splash bitmap and never replaces it from source. No assertion is made that the currently hosted source reproduces the original EXE.

## Reproduction and checks

From a checkout containing this branch, recover into a **new** destination:

```sh
ulimit -t 60
PYTHONDONTWRITEBYTECODE=1 timeout 60 python3 tools/maelstrom-recover.py /tmp/maelstrom-recovery-new
```

This runs the real sequential wrapper with the shared rejecting byte guard and a local sentinel download step before any HTTP retrieval. It requires exit 42 to propagate and the sentinel to remain absent. It then downloads only the pinned Windows URL, capped at 2 MiB, verifies its SHA-256/inventory, and extracts under the new destination. Any predecessor failure stops the batch; there are no retries. Current host free-space and memory checks precede work. Metadata and streamed byte counts are bounded independently. Caller session/evidence growth still needs admission under its own task allocation.

To inspect retained bytes without network or extraction:

```sh
PYTHONDONTWRITEBYTECODE=1 timeout 60 python3 tools/maelstrom-closure.py \
  --archive /tmp/maelstrom-original-win32-closure-oct24/archives/Maelstrom-3.0.6-Windows.zip \
  --root /tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6
```

The explicit extraction command is `python3 tools/maelstrom-closure.py --archive ARCHIVE --extract-to NEW_DIRECTORY`. It refuses an existing destination, validates all paths/symlink attributes, verifies compressed bytes and the declared expanded inventory before extraction, and then validates every extracted hash, PE binding and resource container.

```sh
PYTHONDONTWRITEBYTECODE=1 timeout 60 python3 test/test-maelstrom-original-closure.py \
  --archive /tmp/maelstrom-original-win32-closure-oct24/archives/Maelstrom-3.0.6-Windows.zip \
  --root /tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6 \
  --receipt /tmp/maelstrom-test-receipt.json
```

**24 checks PASS** in [tests.json](maelstrom-original-win32-20261024/tests.json): pristine closure, fresh extraction, existing-destination rejection, missing EXE/both DLLs/all three core resources/title bitmap/license, changed EXE/both DLLs/sprite/CICN/archive bytes, wrapper rejection propagation, missing recursive DLL/export/forwarder targets, malformed PE, and final restored original hashes. Actual files are temporarily removed or changed and restored in `finally`; no replacement game bytes remain. A separate `maelstrom-recover.py --guard-only NEW_DIRECTORY` check passed for the final recovery entry point.

Acquisition batches used the tested sequential wrapper and enforced declared/streamed byte limits; no actual HTTP denial, acquisition size rejection, retries, tool installation, PE execution or native compilation occurred. Shared byte-guard rejection is additionally exercised by the final recovery entry point and tests. Original admission and rejecting sequencing receipts are retained alongside this report.

Remaining work belongs to a new coordinator assignment: provide the six system-DLL API surfaces and any observed SDL backend dependencies, relocate/map original DLLs, map all assets with writable score/config paths, and demonstrate menu-to-play, input, rendering and sound on an assigned runtime. No runtime box was assigned; lifecycle is **N/A** and shutdown remains coordinator-owned.

Final resource, publication and cleanup receipts are outside Git at `/tmp/maelstrom-original-win32-closure-oct24/{resource-final,publication,cleanup}.json`. Full originals and charged session/history receipts remain retained there or in the launcher/session locations recorded by admission; only scripts, manifests, compact static evidence and this report are committed.
