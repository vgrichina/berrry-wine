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
The registration itself has only source/filesystem verification, not a new
runtime qualification. The original direct route reached the first level and
reviewed ordinary left/right response in `20261018-supertux-gameplay`.
Timeout/respawn interrupted the idle comparison. Jump, sustained controls,
browser/touch delivery, audio and FPS remain unqualified. No public release
or deployment is part of this registration.
