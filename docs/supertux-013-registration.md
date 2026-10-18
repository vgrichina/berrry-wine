# Local SuperTux 0.1.3 registration

`supertux_013` is a localhost candidate and CLI app, absent from the public
desktop. Its original six DLLs are explicit load seeds; authentic corpus
MSVCRT is a seventh seed. The original executable runs from `c:\` with
`--sdl --datadir data`, with all assets mounted at their original relative
paths. No original file is edited and sound is not disabled.

Recover the installer and extraction using [the source notes](re-notes/supertux-013.md).
The observed installer SHA256 is
`bc4893dbb84a02beb8958dab1c922a7f715aa08ed463d2a0efa6bc58d79c9a9b`.
Stage its `extracted/app` directory as
`test/binaries/candidates/supertux-013/game` (copy only into a new destination).
Keep the retained extraction evidence intact. Then generate the ordinary
ignored local manifest and verify the exact original tree:

```sh
node tools/fetch-candidate-corpus.js --id=supertux-013 --prepare
node tools/verify-supertux-013.js
```

The verifier rejects changed, additional or missing payload files, symlinks,
incorrect CRT bytes and incomplete/misdirected manifest entries. Its compact
inventory digest represents all 787 path/size/SHA256 rows from the retained
`scratch/runs/20261018-supertux-source/inventory.json`; no second large tracked
manifest is needed. The generated manifest contains 786 companions because
the app registry supplies the executable separately. The default CRT path is
`test/binaries/dlls/msvcrt.dll`, SHA256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
The verifier accepts alternate fixture-root and CRT paths as its two arguments.
It does not fetch, build or execute anything.

After a separately coordinated runtime grant, the registered launch is:

```sh
node test/run.js --app=supertux_013 --no-build --wasm=/absolute/pinned.wasm --quiet-api --max-seconds=60 --max-batches=100000 --batch-size=200000
```

Use a fresh evidence directory and the existing owned-process/disk/log guards.
The initial registration had source/filesystem verification only; the bounded
registered startup below subsequently validated its menu. The original direct route reached the first level and
reviewed ordinary left/right response in `20261018-supertux-gameplay`.
Timeout/respawn interrupted the idle comparison. Jump, sustained controls,
browser/touch delivery, audio and FPS remain unqualified. No public release
or deployment is part of this registration.

## Registered startup validation, 2026-10-18

`scratch/runs/20261018-supertux-registered-startup` records the granted
60-second cooperative CLI run of `--app=supertux_013`, source
`83bbb77fdf7b9823359bdf8c927a02f2e878b34b`, canonical module SHA256
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`.
There was no build, browser or gameplay input. The log confirms all seven
actual DLL mappings. Personally reviewed `sample-0.png` and `final.png`
show Start Game, Bonus Levels, Options, Level Editor, Credits and Quit.

Unlike the earlier direct route's `C:\SUPERTUX`, the registry places the
executable and relative assets at `C:\`. Shared resolver replay verified
all seven DLL hashes and all 787 original relative paths/bytes. This run
validates that absolute relocation through main-menu startup only. The
integration checkout also needed the ordinary `binaries -> test/binaries`
symlink for the explicit corpus CRT seed; no differing file was overwritten.

Child 2227625 exited 0 without signal at 17:22:55.091Z after 60.192 seconds;
controller 2227610 exited 0. Independent postflight and a separate process
check found both absent and no owned process-group survivors. All 3,119
source/runtime pins, 787 retained original files and registered fixture/CRT
verification remained unchanged. Minimum sampled free disk was
3,227,095,040 bytes and log output 1,102,473 bytes; no guard fired.
The evidence record is reviewed, with no missing/invalid artifacts. The
repository-wide evidence checker still reports only the unrelated historical
Zuma containment error. Registered gameplay and the control/audio/FPS limits
above remain open.
