# Original Airstrike pre6a local registration — 2026-10-24

Candidate `airstrike-pre6a` and app `airstrike_pre6a` register the original
icculus Win32 preview. The entry appears in the normal local selector and
`test/run.js --app=airstrike_pre6a`, through the shared app registry. It is
absent from the public desktop, has `localOnly: true`, and has no acquisition
packages. This change distributes manifests, source and recipes only.

The registration preserves empty arguments, guest executable
`C:\airstrike-pre6a.exe`, cwd `C:\`, the unchanged `airstrikerc` and relative
`data` paths. The original configuration selects 800×600 windowed mode,
alpha2, sound1 and one human. Eight explicit authentic DLL seeds cover SDL,
SDL_image, SDL_mixer, jpeg, libpng1, msvcr70, msvcrt and zlib. Both CLI candidate
launch planning and the local browser manifest include every companion.

`test/candidate-corpus/airstrike-pre6a-files.json` pins all **89 game files /
4,072,418 bytes** by path, size and SHA-256. It is derived from the exact
`game/` subset of the accepted 261-file / 17,345,286-byte
[complete runtime manifest](airstrike-retained-codec-gameplay-20261024/complete-runtime-manifest.json)
on reconciled remote main `9b263cea5801886d43b6e818f0b415645bb32a50`.
The remaining runtime manifest rows describe the historical emulator, fonts,
runner and capture dependencies; those are not game files to register.
The 81-file / 2,632,138-byte original EXE/config/data set plus six bundled DLLs,
standing MSVCRT and authentic zlib produce this closure. Rendering sources,
development tools and release documentation are left in the original input.

EXE SHA-256 is
`0e6f5450109c4c83e97bcf263bc90dc2d64dd83587356dd8a87994cc4246b474`.
Authentic zlib is 53,760 bytes, SHA-256
`0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9`.
It is the unchanged `zlib.dll` member of the official SDL_image 1.2.3 Win32
distribution, archive SHA-256
`e7f817604519192ee1be33f66190864898baf81fc87c36ff60e05f71e1901e14`.
The retained [legacy codec provenance](airstrike-legacy-zlib-20261023.md)
binds the exact Airstrike SDL_image/jpeg/libpng importer bytes to that supplier
and its real ordinal/name exports. Do not substitute or rename zlib1.dll,
manufacture DLL exports, re-encode media or disable sound to satisfy the pins.

Original release `LICENSE` identifies the program and most data as GPL;
`COPYING` supplies GPL v2. Some sounds are only *believed* public domain by
the release author. Support DLL licenses remain separate, including Microsoft
CRTs and zlib/minizip notices. See the retained
[original recovery report](airstrike-original-20261023.md) for archive identity
and notice details. This registration adds no redistribution or public hosting.

Use locally retained inputs. No network, installer execution or compilation is
needed. The paths below are the actual standing inputs used for this task;
other local inputs must match the same complete pins. Create the destination's
parent first, then choose a fresh destination:

```sh
mkdir -p test/binaries/candidates
node tools/verify-airstrike-pre6a.js --prepare \
  /tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a \
  /tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll \
  /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll \
  test/binaries/candidates/airstrike-pre6a
node tools/verify-airstrike-pre6a.js test/binaries/candidates/airstrike-pre6a
```

The preparation tool hashes every selected source before creating the output,
requires a fresh destination and the host-free floor, copies files without
links or byte changes, then rehashes all outputs and verifies the 88 exact
companion URL/guest-path/size mappings. The executable is supplied separately
by the app registry. Existing destination files are never overwritten.
`fetch-candidate-corpus.js --id=airstrike-pre6a --prepare` may regenerate the
standard local manifest after preparation; it is not an acquisition recipe.
Run the identity verifier again afterwards. The verifier intentionally rejects
changed/additional/missing game files; preserve saves/config changes separately
before checking the original fixture. Later execution needs separate admission.

Complete static acceptance is reproducible with these same three source inputs:

```sh
timeout 60s node --max-old-space-size=256 test/test-airstrike-pre6a-local-registration.js \
  /tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a \
  /tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll \
  /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll
```

PASS: the test prepares one temporary 89-file fixture, independently compares
every real byte to the accepted manifest, calls production `buildLaunchArgs`,
expands the actual CLI VFS includes and calls the real corpus manifest writer
with network/subprocess entrypoints forbidden. It checks all eight seeds and
all 88 exact mappings. Rejecting controls cover every missing game file,
corrupted EXE/zlib/SDL_image/config/PNG, wrong guest mapping, missing DLL seed,
bad source identity and destination overwrite. Temporary payloads are removed
in `finally`. Without inputs, the test explicitly reports only static registry
checks and skips real-file acceptance. Existing Silver CLI contract, browser
manifest and local-only dropdown regressions pass unchanged.

This is filesystem and JavaScript registration acceptance only. No emulator
build, guest, browser, network package, public deployment or test-box operation
was performed. Actual registered-path runtime/browser/audio/full-game
qualification remains a separate assignment. The independently accepted
[historical gameplay review](airstrike-gameplay-independent-review-20261024.md)
and [producer evidence](airstrike-retained-codec-gameplay-20261024.md) retain
their original scope: bounded movement/fire on historical source `b41a7c5`,
module `8fac3993`, with the Console obscuring the upper scene. They do not
qualify this new registered route or current main. No new visual run is claimed;
future captures must follow `ops/README.md` and publish `result.json` last.

Task receipts are retained at `/tmp/airstrike-original-local-registration-oct24/`
(`admission.json`, `tests.json`, test logs, `publication.json`,
`resource-final.json`). Root tracked files/index/refs and all donors stayed
read-only; shared messageboard updates are append-only. No assigned box:
ID/state/expiry are N/A; lifecycle ownership remains with the coordinator.
