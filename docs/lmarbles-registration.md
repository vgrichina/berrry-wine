# Local LGames LMarbles 1.0.8 registration

Candidate `lmarbles-108`, app `lmarbles_108`, is local only and absent from
the public desktop. This LGames Atomix-style game is distinct from the public
Microsoft Plus 98 Marbles app. The registry preserves the reviewed original
direct route: `C:\LMARBLES\lmarbles.exe`, cwd `C:\LMARBLES`, empty arguments,
all 86 original files and eleven original DLL seeds plus authentic corpus MSVCRT.

The DLLs are SDL.dll, SDL_mixer.dll, iconv.dll, libFLAC-8.dll,
libgcc_s_sjlj-1.dll, libintl-8.dll, libmikmod-3.dll, libogg-0.dll,
libvorbis-0.dll, libvorbisfile-3.dll and libwinpthread-1.dll.
No original bytes, configuration or sound settings are changed.

Recover the [official ZIP](https://downloads.sourceforge.net/project/lgames/lmarbles/lmarbles-1.0.8-win32.zip)
using the [source notes](re-notes/lmarbles-first-launch.md).
The archive is 1,753,947 bytes, SHA256
`5520b52e17373c75325fbcd058a128c0a8264f5178aa9d721a6d0c824307376f`.
Extract safely into a fresh directory. Its lmarbles-1.0.8-win32 directory
contains 86 files totaling 3,800,414 bytes. Read COPYING.txt and the original
manual; no installer is required and no public redistribution is prepared.
Retained originals are under
`scratch/runs/20261018-lmarbles-source/original/lmarbles-1.0.8-win32`.

Verify originals without a copy:

```sh
node tools/verify-lmarbles-108.js --original /absolute/lmarbles-1.0.8-win32 /absolute/msvcrt.dll
```

Prepare a fresh ignored fixture and its 85-companion manifest for a later
coordinated registered launch. The executable is supplied by the app registry.

```sh
node tools/verify-lmarbles-108.js --prepare /absolute/lmarbles-1.0.8-win32 test/binaries/candidates/lmarbles-108 test/binaries/dlls/msvcrt.dll
node tools/verify-lmarbles-108.js test/binaries/candidates/lmarbles-108 test/binaries/dlls/msvcrt.dll
```

The compact sorted path/size/SHA256 inventory digest is independently checked
against retained source-manifest.json. The verifier rejects changed, extra or
missing files, symlinks, incorrect CRT, and missing or misdirected companion
mappings. Preparation requires a fresh destination and checks destination
filesystem free space to retain a 2 GiB floor plus 64 MiB margin. Payload copies
total 3,800,414 bytes. Authentic CRT SHA256:
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.

Use `--app=lmarbles_108` for future registered runs; generic candidate smoke
does not preserve this cwd and DLL seed route. Direct evidence remains
`20261018-lmarbles-passive-startup`: reviewed main menu without input, using
the original explicit-mount route and canonical module a4a4bc6a…. Dashboard
publication may use candidate lmarbles-108 and app lmarbles_108 while retaining
the actual direct command, source/module identity and environment. Registration
is not itself a runtime result.

Registry assertions, browser-manifest tests, independent inventory digest,
original verification, prepared fixture and all 85 mappings passed. Negative
missing/misdirected mapping, incorrect CRT and existing-destination checks also
passed. No build, runtime or browser was performed for registration. Registered
runtime equivalence, gameplay, controls, audio and FPS remain unqualified.
The prepared test fixture exists only in the isolated registration worktree;
integration must run the preparation command before using the app ID.
