# Local LGames LTris 1.2.8 registration

Candidate `ltris-128`, app `ltris_128`, preserves the original windowed route:
`C:\LTRIS\ltris.exe`, cwd `C:\LTRIS`, argument `-w` from `ltris-window.bat`.
It is a local candidate, absent from the public desktop. All forty original
files remain unchanged, including gfx, sounds, documentation and batch files.
The registry seeds all eleven bundled DLLs and the authentic corpus MSVCRT.

The [source notes](ltris-original-source.md) record recovery from the official
Win32 ZIP, 2,379,795 bytes, SHA256
`b64a817fd4031e5f3e0b31bad546b0876ac62ef6c6384eae396b2de127718622`.
Read the original COPYING.txt (GPL version 2) and README.txt. No installer or
licence answer is required. No public distribution is prepared.
Retained original directory:
`scratch/runs/20261018-ltris-source/original/ltris-1.2.8`.
Its forty files total 7,361,674 bytes. Ignored payloads require the recovery
recipe; this source commit does not back them up.

Verify the originals without copying:

```sh
node tools/verify-ltris-128.js --original /absolute/ltris-1.2.8 /absolute/msvcrt.dll
```

Prepare a fresh ignored fixture and its 39 companion mappings. The registry
provides the executable separately:

```sh
node tools/verify-ltris-128.js --prepare /absolute/ltris-1.2.8 test/binaries/candidates/ltris-128 test/binaries/dlls/msvcrt.dll
node tools/verify-ltris-128.js test/binaries/candidates/ltris-128 test/binaries/dlls/msvcrt.dll
```

Preparation refuses an existing destination and requires free space above
2 GiB plus 64 MiB plus payload size. It checks every original path, size and
SHA256 using the compact sorted inventory digest
`3478f9e208874423e61983d0a90df02d1cde36ca85ea2ef9628c79fe68181149`.
The digest was independently derived from retained source-manifest.json.
CRT SHA256 must be
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
Missing, extra, altered or symlinked original files and incorrect companion
mappings fail verification. No generated configuration or sound settings are added.

Future registered runs use `--app=ltris_128`; generic candidate smoke does not
preserve this route. Existing direct evidence `20261018-ltris-passive-startup`
reviewed the main menu without input, retaining edge clipping, on canonical
module `fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Publication under candidate `ltris-128` must retain the actual direct command,
build, environment and timestamps. Registration itself is not runtime evidence.

Source validation passed: registry/corpus identity and local-only membership,
cwd/argument/EXE agreement with passive-plan.json, all twelve DLL seeds,
all 39 exact companion paths, independent inventory, original and prepared
fixture verification, syntax and diff checks. Negative wrong CRT, existing
destination, missing/misdirected mapping and changed payload checks passed;
the isolated fixture was restored and verified afterward.
No runtime, build or browser was executed for registration. Registered runtime
equivalence, gameplay, controls, audio and FPS remain unqualified.
The 7.4 MB validation fixture exists only in the isolated registration worktree;
integration must prepare its own fixture before launch.
