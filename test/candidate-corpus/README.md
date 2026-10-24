# CLI candidate corpus

This is an intentionally separate pool of possible future Wine-Assembly
fixtures. The general survey is not referenced by `test/run-all.sh`,
`test/test-all-exes.js`, the normal browser desktop, or deployment tooling.
DX-Ball and Snood are exceptions: their dedicated installer-plus-game gates
are in the canonical end-to-end matrix, while their packages remain local and
gitignored.

The manifest records exact versions, source pages, package hashes, executable
names, and small CLI smoke budgets. Candidate binaries are downloaded beneath
`test/binaries/candidates/`, which is gitignored like the rest of the local
binary fixture pool.

## Fetch

Original Airstrike pre6a is local only, with no acquisition packages. Use its
[local preparation and verification recipe](../../docs/re-notes/airstrike-pre6a-local-registration-20261024.md)
to preserve all 89 exact game/runtime files and the authentic legacy zlib.
Its local selector/CLI app ID is `airstrike_pre6a`. Registered runtime and
browser qualification remain separate from the accepted historical gameplay.

SuperTux 0.1.3 uses the pinned original Inno extraction and the standard
generated local manifest. See [local registration and verification](../../docs/supertux-013-registration.md)
for recovery, authentic CRT requirements and the source-only verification
boundary. Its app ID is `supertux_013`; no public desktop entry is added.

Fetch every automatically recoverable package:

```sh
node tools/fetch-candidate-corpus.js
```

Fetch selected entries or replace an existing local fixture:

```sh
node tools/fetch-candidate-corpus.js --id=dxball,qbob,cave-story
node tools/fetch-candidate-corpus.js --id=putty --force
```

The fetcher verifies every package against its pinned SHA-1 before extraction.
It uses `7z`, with `unar` as a fallback for older RAR/self-extracting packages.
Entries with no package list are deliberately manual: either the original
package is not directly recoverable, it is too large to pull as part of a
routine candidate setup, or the archived package is not the required Windows
build.

The five `reflexive-*` entries are also manual because preparation uses the
external Reflexive static extractor/unwrapper. Their local fixtures retain
the complete unwrapped `game/` tree, original installer in `sources/`, and
SHA-256 provenance in `.candidate-source.json`. See
[Reflexive probe notes](../../docs/re-notes/reflexive.md) for preparation,
launch settings, and observed blockers. The survey mounts companion assets
and seeds the listed DLLs; use the documented direct commands for the
800×600 display and setup-dialog input needed by individual games.

Ricochet Xtreme and Alien Shooter also have local app entries. After manually
extracting their fixtures, regenerate the browser asset inventories with:

```sh
node tools/fetch-candidate-corpus.js --id=reflexive-ricochet-xtreme,reflexive-alien-shooter --prepare
```

They are selectable on localhost as `ricochet_xtreme` and `alien_shooter`,
and the same entries work with `node test/run.js --app=ID --no-close`.

## Run

Run the local candidate survey in the CLI harness:

```sh
node test/test-cli-candidate-corpus.js
node test/test-cli-candidate-corpus.js --id=dxball,qbob
```

Useful inspection modes:

```sh
node test/test-cli-candidate-corpus.js --list
node test/test-cli-candidate-corpus.js --dry-run
node test/test-cli-candidate-corpus.js --strict
```

DX-Ball also has a dedicated two-stage gate. It drives
the original Wise installer through completion, validates the installed
payload, then launches that payload and requires a visible 640x480 DirectDraw
frame:

```sh
node test/test-dxball-candidate.js
```

This longer test is included in the end-to-end tier of `test/run-all.sh`. It
skips when the local, gitignored DX-Ball package has not been fetched. Set
`KEEP_DXBALL_CANDIDATE_TMP=1` to retain its screenshots and extracted VFS for
inspection.

To make DX-Ball selectable on the local web page, prepare its validated
installed payload and open the debug view:

```sh
PREPARE_DXBALL_DEBUG_WEB=1 node test/test-dxball-candidate.js
open 'http://127.0.0.1:8000/index.html?debug'
```

The `DX-Ball 1.09` option is deliberately debug-only. The prepared files stay
under gitignored `test/binaries/candidates/` and are not part of deployment.

Snood has the same local-only boundary and a dedicated gate that runs its
original bootstrap, preserves the temporary Inno child before bootstrap
cleanup, completes that child installer inside Wine Assembly, and then proves
interactive gameplay plus DirectSound output:

```sh
node test/test-snood-candidate.js
```

Set `KEEP_SNOOD_CANDIDATE_TMP=1` to retain its emulator-installed VFS. Set
`PREPARE_SNOOD_DEBUG_WEB=1` to prepare the ignored `Snood 2.2W` debug app.

The runner rejects DOS and non-x86 files before invoking Wine-Assembly;
Win16 NE and PE32/i386 executables enter the survey. It compiles one immutable WAT
snapshot and reuses that snapshot for every local candidate. The default
survey reports `READY`, `BLOCKED`, `SKIP`, or `HARNESS` and exits successfully
when applications merely hit expected compatibility gaps. `--strict` turns
`BLOCKED` into a failing result. Harness/build failures always fail because
they mean the survey itself could not produce useful evidence.
Each launch is bounded to 20 seconds by default; a manifest entry can override
that when a candidate needs a longer startup window.

## Legal boundary

An Internet Archive item is provenance, not a redistribution license. GPL/MIT
packages still carry their normal notice/source obligations, proprietary
freeware and shareware remain local research fixtures, and Dependency Walker
is explicitly internal-only because its upstream terms forbid bundling it with
another product. None of these files should enter public deployment merely
because the fetcher can recover them.

The two Civilization II entries are commercial-retail compatibility fixtures,
not redistributable game packages. Their pinned Redump-oriented Archive.org
ZIPs prepare Track 01 into a local `cd/` tree and retain the CUE plus all raw
CD-audio tracks. The CLI attaches that CUE lazily through MCI, so launching the
game does not load the soundtrack. GOG does not currently sell a Civilization
II release, so there is no GOG package recipe to maintain yet.

## Dungeons of Dredmor archived beta

Fetch with `node tools/fetch-candidate-corpus.js --id=dungeons-of-dredmor`. This is the community-archived Windows Steam beta depot 98811 revision 8, not a demo. The local experimental selector `dungeons_of_dredmor` mounts its complete asset tree, including the original Steam DLL. No compatibility or Steam availability claim is made; the entry is excluded from the public desktop. See [provenance and static dependency notes](../../docs/re-notes/dungeons-of-dredmor.md).

The separate `dungeons-of-dredmor-release` candidate preserves archived public-game Steam depot98801 revision17, alongside beta98811. It requires manual Steam2 archive preparation; `--id=dungeons-of-dredmor-release --prepare` regenerates the manifest after restoration. Local experimental app: `dungeons_of_dredmor_release`. [Release provenance and limitations](../../docs/re-notes/dungeons-of-dredmor-release.md).

Recovery coverage: run `node tools/audit-candidate-recovery.js` for a static recipe inventory. See [remaining recovery work](../../docs/corpus-recovery-status.md); package recipes do not imply installed-game recovery or source availability.
# Outlaws original demo

Local candidate `outlaws-demo` uses app `outlaws_demo`; see
[registration and recovery](../../docs/outlaws-demo-registration.md).
Use its registered app route to preserve `C:\OUTDEMO` and all original mappings.
