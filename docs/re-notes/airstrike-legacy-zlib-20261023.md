# Airstrike pre6a — authentic legacy zlib closure, 2026-10-23

**Resolved the missing vendor DLL and its exact ordinal ABI.** No guest, wasm, native compilation, dependency rebuild, box operation, emulator edit, app registration or gameplay execution occurred. Static real-PE dependency closure passes. Runtime acceptance remains unexecuted and requires a coordinator-assigned box and qualified existing wasm; no box is assigned here. Shutdown remains coordinator-owned.

This focused task starts at `dd424f7dbe45cc2e730cf26ce17f563679f571ef` on `task/airstrike-legacy-zlib-closure-oct23`. Strict configured SSH readback confirmed remote main `868e0440bdad4de2a364423da513aeb0b9e00e69` and the original task ref at the supplied prior commit. Root dirty files, shared refs, Claude/Shadow Man/RichEdit/POSITIONT ownership and the Penguin worker's tree remain untouched. The prior original acquisition report/evidence is reused read-only; its incomplete objdump capture was neither retried nor treated as complete.

## Supplier and compatibility proof

The [official SDL_image release directory](https://www.libsdl.org/projects/SDL_image/release/) supplies [SDL_image-1.2.3-win32.zip](https://www.libsdl.org/projects/SDL_image/release/SDL_image-1.2.3-win32.zip). HTTPS certificate validation remained enabled, without redirects. Retained `sdl123.headers` records HTTP 200, Content-Length 160219 and Last-Modified 2013-08-17. That is the server's archive timestamp, not a claim about original compilation date. No publisher signature was supplied; hashes identify the retrieved bytes.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Official SDL_image ZIP | 160,219 | `e7f817604519192ee1be33f66190864898baf81fc87c36ff60e05f71e1901e14` |
| Original ZIP member `zlib.dll` | 53,760 | `0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9` |
| Official zlib 1.1.3 source tar.gz | 168,463 | `cae5847bc0e1cf113d3f70d037400da3e47c2e2b7b1c96b0b08447a5fbb906f4` |

ZIP inventory was inspected before extraction: five members, 355,046 uncompressed bytes, maximum member 169,443 bytes. Extracted members passed ZIP CRC verification. The genuine provider retains the archive name `zlib.dll`, PE export-module name `zlib.dll`, machine i386/PE32 and file version 1.1.3.1. Its bytes and exports are unmodified. No incompatible zlib1.dll was renamed; the Penguin archive was not accessed or changed. One primary binary candidate succeeded, so a second candidate or broader crawl was unnecessary.

**The actual Airstrike importer is identical to the supplier's importer.** `matching-distribution.json` proves all three Airstrike DLLs below match the official SDL distribution by full-file SHA-256:

| DLL | SHA-256 |
| --- | --- |
| libpng1.dll, 94,720 bytes, PNG 1.0.8 | `3f10e96d56d45e5c62d5b1fa12182503e8c1f59b6a0018dbb4dcea3df208811f` |
| SDL_image.dll | `80d5825b9697cf769e58472aeac87338214702feef9e095f552be33564b25d35` |
| jpeg.dll | `ac3f25027c9725fb6c6a4d54b3764b08cd99928a395b1cfe8682bb447b3790be` |

Thus the recovered zlib is the legitimate matching distribution's provider for this exact libpng binary. Compatibility does not rest on the presence of nine integers. `required-mapping.json` binds importer/provider hashes and each export name/RVA; `zlib-pe.json` retains every export and import. The following lists imports in their original thunk order:

| Required ordinal | Authentic export | Export RVA |
| ---: | --- | --- |
| 10 | deflateReset | 0x1e20 |
| 3 | crc32 | 0x19a0 |
| 7 | deflateInit2_ | 0x1b20 |
| 6 | deflateEnd | 0x22f0 |
| 4 | deflate | 0x1f70 |
| 20 | inflateEnd | 0x5ba0 |
| 22 | inflateInit_ | 0x5d10 |
| 19 | inflate | 0x5d30 |
| 23 | inflateReset | 0x5b50 |

All required exports are backed functions, with no forwarders. As independent source corroboration, the entire 61-entry binary export name/ordinal map equals `contrib/minizip/zlibvc.def` from [official zlib 1.1.3 source](https://zlib.net/fossils/zlib-1.1.3.tar.gz). `msdos/zlib.def` independently gives the same required core mapping. Retained source-zlib.h describes the z_stream interfaces and initializers; the source supports the mapping and license, not a claim of reproduced binary compilation. Exact importer identity within the official matching binary distribution is the semantic compatibility proof.

## License and recursive closure

`source-zlib.h` retains Jean-loup Gailly/Mark Adler's 1995–1998 copyright and full zlib permissive notice: use/redistribution permitted, origin must be truthful, altered source marked, and source notice retained. `source-unzip.h`/`source-zip.h` retain Gilles Vollant's minizip notice under the same terms; these matter because this binary also exports minizip functions. `sdl123-README.txt` separately supplies the SDL_image LGPL runtime notice. Do not apply that blanket notice in place of the zlib/minizip notices. Source member inventory, primary URL/HTTP receipt and selected unchanged source files are retained. No exact binary build reproducibility or publisher signature is asserted.

`recursive-closure.json` reuses the prior seven-PE inventory and standing MSVCRT donor, adds the recovered provider, and checks every supplied-PE import by exact name or ordinal against the provider exports. **Zero unresolved real-PE imports.** The eight explicit DLLs for the ad-hoc harness are the six bundled DLLs, standing MSVCRT.dll and recovered zlib.dll. Their recursive system imports continue through emulator thunks.

Recovered zlib imports CRTDLL.dll by name (18 functions) and KERNEL32.dll (GlobalAlloc, GetVersion, GlobalFree), with no delayed imports. CRTDLL is recognized as a Windows system DLL in `lib/dll-loader.js`; no extra vendor CRTDLL binary is required for this static vendor inventory. Two names are absent from the current API table: **CRTDLL._fdopen and CRTDLL.rewind**. They are potential runtime fail-fast observations, not proof of startup failure, permission to patch, or a reason to fabricate exports. Prior gaps remain WINMM.waveOutGetErrorTextA, WINMM.midiStreamStop and KERNEL32.IsDBCSLeadByteEx. API-table presence proves neither implementation correctness nor CRT FILE-layout compatibility. Dynamic LoadLibrary/GetProcAddress behavior remains unobserved. No complete runtime-readiness or gameplay claim is made.

## Corrected minimal launch recipe — UNEXECUTED

`minimal-vfs.json` preserves 81 exact paths/hashes totaling 2,632,138 bytes: EXE, airstrikerc and all data/**. No data copy was made. Use the original donor's release directory and preserve CWD `C:\`, `datapath "data"` and exact relative names. Six bundled DLLs plus MSVCRT and zlib are loaded explicitly. The harness supports **--dlls** (test/run.js:5472), --no-build/--wasm, --exe, --cwd, --no-threads, --max-seconds, --max-batches, --batch-size, --tick-ms-per-batch, scheduled keyboard/PNG actions, and --png. Prior recipe's **--vfs-include='airstrikerc,data/**/*' was invalid**: this is a repeatable flag containing one glob each, not a comma-separated glob list (test/run.js:993; lib/vfs-host-files.js). Corrected below. `launch-source-identities.json` binds the actual local inspected files; no harness or Node process was run.

Only after separate coordinator runtime/resource admission, with a qualified existing wasm, an assigned box, transferred/adjusted paths and an admitted streaming log/capture wrapper:

```bash
cd /home/user/wine-assembly
AIRSTRIKE=/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a
VERIFIED_ZLIB=/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll
# Coordinator supplies QUALIFIED_WASM and a fresh existing RUN directory.
test -s "$QUALIFIED_WASM" && test -s "$VERIFIED_ZLIB" && test -d "$RUN" &&
node test/run.js --no-build --wasm="$QUALIFIED_WASM" \
  --exe="$AIRSTRIKE/airstrike-pre6a.exe" \
  --dlls="$AIRSTRIKE/SDL.dll,$AIRSTRIKE/SDL_image.dll,$AIRSTRIKE/SDL_mixer.dll,$AIRSTRIKE/jpeg.dll,$AIRSTRIKE/libpng1.dll,$AIRSTRIKE/msvcr70.dll,/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll,$VERIFIED_ZLIB" \
  --vfs-include=airstrikerc --vfs-include='data/**/*' --cwd='C:\' \
  --quiet-api --no-threads --max-seconds=30 --max-batches=2000 \
  --batch-size=20000 --tick-ms-per-batch=5 \
  --input="30:keypress:13,90:png:$RUN/before.png,100:keydown:188,150:keydown:37,180:keydown:190,250:png:$RUN/movement-fire.png,350:keyup:37,400:keyup:190,450:keyup:188,500:png:$RUN/after.png" \
  --png="$RUN/final.png"
```

This command is an acceptance starting point, not a tested timing prescription. First observe the introductory gate; move the batch schedule if required. Return starts play; comma accelerates, Left/Right turn, period fires and Space performs the special action, as documented by prior source inspection. Next acceptance requires before/during/after frames showing the human plane's trajectory responding to held controls and emitted projectiles. Startup/background animation alone is insufficient. Stop at the first concrete loader/API/opcode failure and retain its bounded diagnostic. Observe rather than preemptively patch the five table gaps. Future captures need their own memory/disk/per-file/aggregate admission and streaming enforcement before buffering/writing; record actual wasm/revision/environment and inspect images before publishing ops result.json last. No runtime evidence directory/result.json is fabricated here.

## Recovery, resource accounting and checks

Ignored authentic ZIP/DLL/source archive and selected distribution members remain under `/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/`. They are local retention only, not a remote binary backup. Prior original donor remains in its original `/tmp/airstrike-original-private-oct23/...` location. To recover zlib independently into a new nonexistent destination, run `timeout 60s python3 recover.py /new/empty-destination` from the committed evidence script. It verifies exact ZIP size/hash, inventory totals, selected DLL CRC/size/hash, rejects redirects and streams under its admitted limit. `recover.py --self-test` verified byte-limit rejection and absent downstream sentinel; no redundant network download occurred. `bounded-source.py` retrieved the one primary source archive with the same pre-buffer byte-bound approach after its rejection test. The initial SDL download used curl --fail --max-time 30 --max-filesize 262144 with set -e. All downloaded files stayed below 262144 bytes; source and binary member inventories were inspected before selection.

First measured gate `allocation.json`: **48,626,011 projected NEW bytes / 67,108,864 cap**, including private Git/checkout, downloads, extraction, evidence/temp, external launcher logs plus Codex session existing/future growth, and **8,388,608 reserve inside the cap**. Host 4,357,115,904 free minus full projection = **4,308,489,893**, above 2,982,150,144. Standing donor logical bytes 9,815,765 and installed Python/Git/curl/objdump paths/full-file identities/footprints were separately recorded; no donor/tool duplication was concealed. No Node was needed. Python invocations used timeout 60s, files <=24 MiB and bounded targeted output; no broad disassembly or full objdump capture was performed.

`timeout 60s python3 check.py` passed nine required mappings, all 61 exports against the historic .def, three exact matching distribution DLL identities, and all recursive real-PE import edges. It also generated the minimal VFS manifest and source identities. It extracts only parser definitions from standing inspect.py, avoiding that script's acquisition/output side effects. Guard self-test passed. Final resource and evidence seals are adjacent. Reports/manifests/recipes/notices are committed; executable/archive bytes are intentionally ignored. Task stops after publication; coordinator owns runtime admission and all future box lifecycle.
