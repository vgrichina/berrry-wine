# Original TuxRacer PE startup contract — 2026-10-29

Pinned main: `3239df2388ec1599deb229b22ea1fb1e2b8f03fa`. Static byte/source analysis only; no guest, Tcl, DLL, browser, build, Wine, Boat, FUSE, download or installer execution. No repeated asset/staging/registration acceptance.

The prerequisite is **BLOCKED**. In EXE descriptor/thunk order the first concrete fail-fast OpenGL import is `OPENGL32.dll!glVertex2dv`, API ID **4448**: the actual generated dispatch calls `$handle_gl_unimplemented`, whose body calls `$host_crash_unimplemented` and executes `unreachable`. The first direct EXE unresolved import is `GLU32.dll!gluScaleImage` (hint 41): its FNV-1a hash has no entry in the actual generated hash table. `$lookup_api_id` returns 65535, the unsigned generated dispatch falls through to `$handle_fallback`, and that handler reports the guest frame then traps. These are failures **if called**, not a claim about the first API actually executed.

A necessary correction discovered while checking generated code: API row 4298 labels `glGetTexLevelParameteriv` with `gl_unimplemented`, but the generated arm actually calls `$handle_gpu_api(115,4,...)`. Thus table handler metadata alone produces a false fail-fast result. The report and regression explicitly preserve this exception. Eight EXE imports actually dispatch to `gl_unimplemented`: `glVertex2dv`, `glTexCoord2dv`, `glTexCoord2d`, `glColor3dv`, `glMultMatrixd`, `glGetBooleanv`, `glRectf`, `glColor4dv`.

## Genuine retained input identity

| Image | Bytes | SHA-256 | Imports | Exports |
|---|---:|---|---:|---:|
| tuxracer.exe | 274432 | a40fd89429d76f379bc7b36d17126bcc61ce487687cb5e951f7757aa6b740971 | 201 | 0 |
| TCL83.DLL | 619520 | 61697e854d7ef53d9757aedb33749b04dc7f7504515143732c92fdaa4c834eef | 203 | 750 |
| SDL.dll | 210944 | 101732c9f75df3574a66ee4094df549aad63960bdb56025a61244336e69b03b8 | 137 | 175 |
| SDL_mixer.dll | 200704 | 160cb3f7f4dcfcfe66c539bc8440bb01e46913b8a941648d03baa6895df48aad | 77 | 46 |

Only these four original files were read, in place, under the dispatch's retained verified media tree. No second payload copy exists. The supplied inventory hash is `2c2d29a9dc7e5f9bc9e972b408fd83dbb17e8ca48a6aed09ffd375830284d8d8`; prior 158-file acceptance is reused, not repeated.

## Transitive contract and loader routes

All **618** import slots are inventoried in `contract-evidence.json`, with exact source/image pins, name, hint or ordinal, provider, generated API call, and bundled export ordinal/RVA. All four images have zero ordinal imports and zero forwarded exports. The parser nevertheless retains unnamed ordinal exports and recognizes forward strings; synthetic tests cover both. There is therefore no forwarded dependency to chase in this original set.

The EXE imports 23 names from TCL83, 27 from SDL and 15 from SDL_mixer. SDL_mixer imports 20 names from SDL. All **85** match actual nonzero bundled export RVAs; these are original guest code, not emulated Tcl/SDL API handlers. The remaining 533 slots use emulator API thunks, with known missing names recorded but no assertion that every present handler implements its contract.

System dependency descriptors are: EXE → KERNEL32/OPENGL32/GLU32; TCL83 → USER32/ADVAPI32/MSVCRT/KERNEL32; SDL → WINMM/KERNEL32/USER32/GDI32/MSVCRT; SDL_mixer → KERNEL32 plus bundled SDL. No additional original DLL appears in the pinned inventory or registration.

`src/08-pe-loader.wat:$process_imports` initially creates name/hash API thunks; `src/08b-dll-loader.wat:$process_dll_imports` resolves already loaded DLL exports or creates system thunks. `lib/dll-loader.js:loadDllsOwned` maps the registered DLL list, patches EXE imports with `patchExeImports`, then DLL-to-DLL imports with `patchDllImports` before initialization. `$patch_caller_iat` resolves original exports. The source order includes these fragments and the generated dispatch through pinned `src/main.watx`. This identifies the source-level resolution route; it does not execute or certify initialization.

TCL83's first missing ordinary MSVCRT name in descriptor order is `_getpid`; further CRT and serial APIs also lack rows. SDL imports `MSVCRT!__p__iob` without a row. Full API semantics (including data-vs-call exports such as `_HUGE`/`_timezone`) were deliberately not broadened into another audit after decisive direct EXE blockers. Inventory statuses explicitly mark those limits.

## Next bounded prerequisite

Before claiming startup import compatibility, an assigned fix must provide the real `gluScaleImage` contract and resolve the actual generated fail-fast GL vector/double entry points, or an independently justified authentic provider route. Then a separately authorized bounded production startup observation must include DLL/TLS/CRT initializers and report the first actually reached API failure. No speculative repair is included here. Static import order cannot establish execution order; Tcl/SDL initialization may encounter a different missing dependency earlier.

Dynamic `GetProcAddress` targets, computed Tcl resource closure, gameplay, rendering correctness and complete transitive handler behavior remain **UNKNOWN / NOT TESTED**. Successful registration is not gameplay success.

## Reproduction and tests

From the owned repository, with the retained media and supplied read-only object stores present:

```
python3 test/tuxracer-original-pe-startup-import-contract-oct29/materialize-source.py
python3 test/tuxracer-original-pe-startup-import-contract-oct29/run-contract.py
python3 test/tuxracer-original-pe-startup-import-contract-oct29/run-tests.py
```

The materializer names only the exact extra source blobs in `extra-source-pins.json` (under 4 MiB total), verifies size/hash and never fetches or mutates a donor. The supervisor requires a keyword-only owned cwd, explicit Git `-C`, validates Git toplevel/absolute-git-dir before mutation, admits disk/RAM before spawning, applies Python DATA128MiB/Git DATA256MiB only per child, CPU90/wall120, file12MiB, capture2MiB, physical per-process/group RSS checks and process-group cleanup. Cwd negative controls reject omitted/root/donor/outside cwd before the sentinel can run. No Node execution is needed.

Seven tests cover exact source and image identities, original bundled export matching, generated dispatch vs row metadata, ordinal/name/forward parsing and OFT fallback, truncated/unbacked/non-PE rejection, missing-export negative oracle and cwd/Git negative controls. Tests do not execute production guest code or predecessor wrappers. Resource and cleanup receipts remain task-owned. Allocation stays reserved through coordinator closeout; no board append or main publication. No test box assigned; lifecycle remains coordinator-owned.
