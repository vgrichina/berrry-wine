# Local LGames Barrage 1.0.5 registration

Candidate `barrage-105`, app `barrage_105`, preserves the original windowed route:
`C:\BARRAGE\barrage.exe`, cwd `C:\BARRAGE`, argument `-w` from `barrage-window.bat`.
It is a local candidate, absent from the public desktop. All forty-five original
files remain unchanged, including gfx, sounds, documentation and batch files.
The registry seeds all eleven bundled DLLs and the authentic corpus MSVCRT.

The [source notes](re-notes/barrage-105.md) record recovery from the official
Win32 ZIP, 1,455,807 bytes, SHA256
`bc4f43d1bc67c7e0db8168083d5b901a6123bbc5ccc9c9346852e68c3dcbd080`.
Read the original COPYING.txt (GPL version 2) and README.txt. No installer or
licence answer is required. No public distribution is prepared.
Retained original directory:
`scratch/runs/20261018-barrage-source/original/barrage-1.0.5-win32`.
Its forty-five files total 4,256,910 bytes. Ignored payloads require the recovery
recipe; this source commit does not back them up.

Verify the originals without copying:

```sh
node tools/verify-barrage-105.js --original /absolute/barrage-1.0.5-win32 /absolute/msvcrt.dll
```

Prepare a fresh ignored fixture and its 44 companion mappings. The registry
provides the executable separately:

```sh
node tools/verify-barrage-105.js --prepare /absolute/barrage-1.0.5-win32 test/binaries/candidates/barrage-105 test/binaries/dlls/msvcrt.dll
node tools/verify-barrage-105.js test/binaries/candidates/barrage-105 test/binaries/dlls/msvcrt.dll
```

Preparation refuses an existing destination and requires free space above
2 GiB plus 64 MiB plus payload size. It checks every original path, size and
SHA256 using the compact sorted inventory digest
`25615b915a23144e4874ed96b670397f29eb0bd341288b79460b79bc91141db7`.
The digest was independently derived from retained source-manifest.json.
CRT SHA256 must be
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
Missing, extra, altered or symlinked original files and incorrect companion
mappings fail verification. No generated configuration or sound settings are added.

Future registered runs use `--app=barrage_105`; generic candidate smoke does not
preserve this route. Existing direct evidence `20261018-barrage-passive-startup`
reviewed the main menu without input, on canonical
module `fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Publication under candidate `barrage-105` must retain the actual direct command,
build, environment and timestamps. Registration itself is not runtime evidence.

Source validation passed: registry/corpus identity and local-only membership,
cwd/argument/EXE agreement with passive-plan.json, all twelve DLL seeds,
all 44 exact companion paths, independent inventory, original and prepared
fixture verification, syntax and diff checks. Negative wrong CRT, existing
destination, missing/misdirected mapping and changed payload checks passed;
the isolated fixture was restored and verified afterward.
No runtime, build or browser was executed for registration. Registered runtime
equivalence, gameplay, controls, audio and FPS remain unqualified.
The 4.3 MB validation fixture exists only in the isolated registration worktree;
integration must prepare its own fixture before launch.
