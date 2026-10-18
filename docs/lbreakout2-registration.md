# Local LBreakout2 2.5.1 registration

Candidate `lbreakout2-251`, app `lbreakout2_251`, is local only and absent from
the public desktop. The registered route preserves the passive direct route:
`C:\LBREAKOUT\lbreakout2.exe`, cwd `C:\LBREAKOUT`, empty arguments, all 220
original client files, five original DLL seeds (`SDL.dll`, `SDL_mixer.dll`,
`SDL_net.dll`, `libpng.dll`, `zlib.dll`) and authentic corpus MSVCRT. No game
configuration, original bytes or sound options are changed.

Recover the official ZIP using [the source notes](re-notes/lbreakout2-251.md).
Its SHA256 is `a152c0867abf9bc39563db932ebcd0797ed3e35d20f21c2dca2a81e321313675`
and size 3,322,804 bytes. Extract safely into a fresh directory, preserving all
230 files (5,606,025 bytes). Original source evidence lives at
`scratch/runs/20261018-lbreakout2-source/original`. No installer execution is
needed. Read the original README/COPYING; no public redistribution is prepared.

Verify the retained originals without copying anything:

```sh
node tools/verify-lbreakout2-251.js --original /absolute/original /absolute/msvcrt.dll
```

For a future registered launch, prepare a fresh ignored fixture (4,948,104
payload bytes) and its exact 219-companion manifest. The executable is supplied
separately by the app registry:

```sh
node tools/verify-lbreakout2-251.js --prepare /absolute/original test/binaries/candidates/lbreakout2-251 test/binaries/dlls/msvcrt.dll
node tools/verify-lbreakout2-251.js test/binaries/candidates/lbreakout2-251 test/binaries/dlls/msvcrt.dll
```

The verifier pins compact sorted path/size/SHA256 inventories of the 230-file
archive and 220-file client, independently derived from retained
`source-manifest.json`. It rejects changed/additional/missing files, symlinks,
wrong CRT bytes and incomplete/misdirected companion mappings. Preparation
requires a fresh destination and preserves a 2 GiB disk floor plus 64 MiB
margin. The authentic CRT SHA256 is
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
The original-only mode does not validate a staged mapping manifest.

Use the app ID for later coordinated runs; generic candidate smoke does not
preserve this cwd and CRT seed. Keep the direct evidence identity separate:
`20261018-lbreakout2-passive-startup` reviewed only the main menu with no input,
using the original direct route and canonical module `a4a4bc6a…`. Registration
has filesystem/JavaScript verification only. No build, runtime or browser was
performed for registration. Gameplay, controls, audio, FPS and registered
runtime equivalence remain unqualified. Dashboard publication can use candidate
`lbreakout2-251` and app `lbreakout2_251` while retaining actual direct commands
and source/module identities; the registration itself is not a runtime result.

Registration validation: registry assertions, candidate browser-manifest tests,
230-original/220-client inventory verification, authentic CRT, all 219 mappings,
and negative missing/misdirected mapping checks passed. The broader candidate
CLI test fails its existing Baldur's Gate source URL/SHA-1 assertion; the same
failure reproduces with the unmodified base manifest. The test fixture exists
only in the isolated registration worktree; integration needs the preparation
step above before using the app ID.
