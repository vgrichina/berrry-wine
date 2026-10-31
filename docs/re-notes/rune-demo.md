# Rune (Human Head, 2000) Windows demo

## 2026-10-31: original media recovered; ordinary launch prepared

**Static media recovery succeeded.** Shipped `System/Manifest.ini` identifies
**Rune Demo, Version=101 Demo**; the payload includes Human Head's original
demo license, release notes and October 2000 files. Work began on main
`1b8e2b4115a71dc38140053bdbe51e7ce7e3c7ce` and stayed on shared main.
No installer, game or browser ran. Compatibility and gameplay remain untested.
Browser availability is the next prerequisite; it was not investigated or
retried. No engine, registry, public app list or guest bytes changed.

All recovery media, evidence and host metadata are ignored under
`scratch/runs/20261031T2253Z-rune-demo-media-resume/` (`R` below). Only this note
is committed. The historical disk-only outcome below is superseded by this
recovery; predecessor registry/local-media findings were reused, not repeated.

### Provenance and size check before package download

Direct source:
[GamesDomain demo mirror](https://ftpmirror1.infania.net/pub/gamesdomain/demos/runedemo.exe),
listed in its [directory](https://ftpmirror1.infania.net/pub/gamesdomain/demos/).
HTTP HEAD advertised **90,741,739 bytes**, byte ranges and last modification
`2002-04-04T22:00:00Z` (mirror timestamp, not release date).
[Contemporary release coverage](https://www.shacknews.com/article/10177/rune-demo-released)
dated October 29, 2000 reports Human Head's 86.5 MB demo.
[Frag-Net](https://www.frag-net.com/game_rune.html) independently labels the
FilePlanet `runedemo.exe` as the Win32 Rune demo, 86.5 MB; that second package
was not downloaded or compared.

Initially fetched only HTTP ranges `0-65535` and the final 131,072 bytes.
The PE stub identifies the Wise Installation Wizard, not the game executable.
REWise read the original Wise file table from the **64 KiB head before full
download**: **143 members, 128,692,369 expanded bytes**. This exact advertised
total superseded the rounded DiscMaster directory estimate. At admission,
`/home` had **2,820,882,432 free bytes**: package plus extraction plus a
200,000,000-byte reserve projected above the required 2,000,000,000-byte floor.
After extraction it had 2,600,448,000 free bytes; later checks still showed
about 2.59 GB. No foreign artifacts were removed.

[DiscMaster's historical CD catalog](https://discmaster.textfiles.com/view/14552/K-CD_2001-04.iso/Rune/runedemo.exe?json)
advertises the same package size and BLAKE3
`440b16040e7d96624ef063103c83dbbc0c7c9dd9c203449ac18006f6b2dbea09`.
This is upstream provenance, **not a locally verified package hash**: no local
BLAKE3 implementation was available. Matching size alone does not establish
equality. Saved HTTP headers, pages, ranges, catalog JSON and
`download-plan.json` retain these distinctions.

### Actual executable and complete original-file pins

| Object | Bytes | SHA-256 |
| --- | ---: | --- |
| Downloaded `runedemo.exe` installer | 90,741,739 | `048e14f0b9f5c9945ce506778452b251f6f625ba62a77e6b352ee33d3f3eca1a` |
| Actual `System/Rune.exe` | 233,472 | `dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add` |
| `original-payload-inventory.json` | 22,016 | `914a23729fae4644e37db554cf0784530035c88f52691fde28443a5338fd52e6` |
| `full-extraction-inventory.json` | 24,155 | `5d5bf9defa1b266c539256f01f6d35d1ae6276acf5078827370824adca0aa64b` |
| `System/License.int` | 9,984 | `11cc9140a5b44f1b1fe614f36a8ec835120351c9a187a426d821477fac077996` |

The original game tree `R/extracted/TEMP/runedemo/` contains **142 files,
128,542,865 bytes**, including `Setup.exe`, `System/Setup.exe` and
`System/UCC.exe`. Complete extraction additionally preserves Wise's
149,504-byte `UNINSTALL_PATH` member. Each inventory contains the real relative
path, byte count and SHA-256 of **every** corresponding member, sorted by
case-sensitive relative path; JSON is UTF-8, two-space indentation, final
newline, with `schemaVersion: 1` and `files: [{path, bytes, sha256}]`.
Full-extraction paths include `TEMP/runedemo/`; payload paths start at that
root. These pins cover the whole original payload, not selected startup DLLs.

All six Help files, including `Help/ReleaseNotes.htm`, and
`System/License.int` remain unmodified. The latter is Human Head's shareware
demo agreement with distribution conditions; retain the complete original
package and license. No media was published or redistributed.

### Reproducible static recovery

Extractor source: official REWise revision
[`c3d3b68903a90ec53ff7b0a4ae704adc6302814b`](https://codeberg.org/CYBERDEV/REWise/src/commit/c3d3b68903a90ec53ff7b0a4ae704adc6302814b).
Source archive URL is
`https://codeberg.org/CYBERDEV/REWise/archive/c3d3b68903a90ec53ff7b0a4ae704adc6302814b.tar.gz`;
1,724,088 bytes, SHA-256
`7f18fd53180cc4f9547fb62c232952b414b71e5c89286604751c898a91e447da`.
Extracted only `rewise/src/`, README.md, COPYING and Makefile (276,556 bytes).
The locally compiled 90,856-byte extraction helper has SHA-256
`80182291fe1b7d4c22d06cc568100692106ccb7b6e19fae0615198918281cf1c`;
compiler-dependent binary identity is separate from source identity. No
project/runtime build or compilation container was used.

Use a newly claimed ignored directory for reproduction; replace `R` below
with that path and preserve existing destinations. First repeat HEAD/disk
admission, download the source archive and verify its hash, then extract only
the source paths above. Require HTTP 206 for the range probe:

```sh
R=scratch/runs/20261031T2253Z-rune-demo-media-resume
gcc -Wall -I"$R/rewise-src/rewise/src" \
  "$R"/rewise-src/rewise/src/{rewise,CP1252,print,reader,exefile,pkzip,wildcard,wisescript,wiseoverlay}.c \
  -o "$R/rewise" -lz
mkdir -p "$R/rewise-tmp"
curl --fail --range 0-65535 \
  https://ftpmirror1.infania.net/pub/gamesdomain/demos/runedemo.exe \
  -o "$R/range-head.bin"
"$R/rewise" -l -p -t "$R/rewise-tmp" "$R/range-head.bin"
# Require 143 members / 128692369 expanded bytes and sufficient disk headroom.
curl --fail https://ftpmirror1.infania.net/pub/gamesdomain/demos/runedemo.exe \
  -o "$R/runedemo.exe"
# Verify package SHA-256 against the table before extraction.
mkdir "$R/extracted"
"$R/rewise" -x "$R/extracted" -p -t "$R/rewise-tmp" "$R/runedemo.exe"
"$R/rewise" -V -p -t "$R/rewise-tmp" "$R/runedemo.exe"
node "$R/check-media.js"
```

Regenerate inventories in the stated format for a fresh run and compare their
pinned digests and every original member. Retained `check-media.js` verifies
this existing recovery, package, inventories, complete file set and host
metadata. Actual download used bounded Python streaming with a package-size
cap and disk checks before each MiB; extraction also monitored the disk
reserve. Repeat those guards if shared usage is changing. Verification gave
**143 CRC32 successes, exit 0**; advertised paths/sizes equal the extraction
exactly. `source-preflight-correction.txt` records planning errors corrected
before package download: a conservative source-size guard and a directory
parser initially counting the site's download-limit label.

### Ordinary host manifest and dependency plan

`R/browser-manifest.json` is host metadata **outside the original tree**:
schema version 1, 141 companions, each with its actual size, URL
`extracted/TEMP/runedemo/<relative-path>` and `vfsPath` `c:\<relative-path>`.
Only main `System/Rune.exe` is excluded from companions. All original tools,
docs, configurations and assets remain mapped. Manifest SHA-256:
`589295d2c89266db60bb2cfca317e22db7c937294d0e9e40516fe6dfc9c41630`.
`R/launch-plan.json` contains the full proposed ordinary local entry:

```js
{
  exe: R + '/extracted/TEMP/runedemo/System/Rune.exe',
  exeGuestPath: 'c:\\System\\Rune.exe',
  workingDirectory: 'c:\\System',
  args: '',
  dlls: ['MSVCRT.dll', 'Core.dll', 'Engine.dll', 'Window.dll']
    .map(name => R + '/extracted/TEMP/runedemo/System/' + name),
  files: [],
  localFileManifest: R + '/browser-manifest.json',
  requiredFiles: true,
  relativeMouse: true,
  fileConcurrency: 8
}
```

The shipped `[PlayShortcut]` specifies `%DestPath%\System`, `System\Rune.exe`
and **empty parameters**. Keep that route and original first-run wizard.
`Rune.ini` and `User.ini` are shipped originals; do not generate replacements.
Rune.ini has empty `FirstRun`, 640×480 settings, `StartupFullscreen=True`,
`D3DDrv.D3DRenderDevice`, windowed `SoftDrv.SoftwareRenderDevice`,
`Galaxy.GalaxyAudioSubsystem` and `LocalMap=intro.run`. Relative search paths
cover System, Maps, Textures, Sounds, Music and Meshes. Seven original maps
include Intro, Entry, DEMOHel1 and DEMOThor. No Music files are shipped; a
generic Music search path does not establish a missing required download.

Current `lib/app-files.js` SHA-256 is
`4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7`.
Cheap merge and loading-policy checks pass: **51 eager companions /
7,411,746 bytes; 90 streamable / 120,897,647 bytes**, zero unknown sizes.
All DLL/EXE/INI/INT companions stay eager. Its optional
`localManifestIntegrity` helper rejects inventories with multiple EXEs; that
one-EXE limit was confirmed against this complete four-EXE tree. Do not enable
the opt-in or delete original files to satisfy it. Use the ordinary manifest
route and verify all original pins before a future launch.

Static PE inspection of all 17 DLLs and three System EXEs is retained in
`*.pe.txt` and `pe-imports.json`. Rune directly imports Window, Core, Engine,
bundled MSVCRT and ordinary Win32 system APIs. Original dynamically selected
modules include WinDrv, Render, SoftDrv, D3DDrv, OpenGlDrv, Galaxy, IpDrv and
Fire. Release notes require DirectX 7.0 or later; D3DDrv resolves DirectDraw
entry points dynamically. Glide/MeTaL alternatives import absent
`glide2x.dll`/`metal.dll`; they are optional renderer dependencies, not reasons
to fabricate DLLs or preload every alternative. Host API support, decorated
native exports, renderer/audio initialization and first-run behavior remain
runtime questions. Installer metadata includes associations and installed-app
registry entries; necessity for direct gameplay is unproven. No keys, version
resources, replacement DLLs or success overrides were injected.

Next prerequisite: available browser access for a separately authorized
ordinary local launch, with the proposed entry added to the local registry
(future ID `rune_demo`, route `/?debug&app=rune_demo`) and media served by the
ordinary host. **That route is not currently registered or live.** Observe the
original first-run flow and stop at its first actual dependency failure;
do not skip it with safe-mode flags, configuration edits or registry injection.
No graphics, input or gameplay claim follows from this recovery.
Boat/runtime allocation and box ID/state/expiry: **N/A**.

## Historical pre-recovery record (superseded media unknowns)

Predecessor run `20261031T2252Z-rune-demo-original-recovery` examined main
`239b5e25917a336f2ffaf6a61c836c568e31a211` and stopped before source recovery:
free disk was initially 1,419,689,984 bytes, later 1,582,256,128. Its original
`preflight.json`, `host-preflight.json`, `local-media-search.txt` and
`RECOVERY.txt` remain untouched. The owner subsequently restored disk by
hardlinking verified duplicate cabinet bytes.

Reused findings: no Human Head Rune in the checked public/local/debug/APPS
registries (46 public, 184 local rows at that preflight), corpus or status
notes; no competing qualification/hold found on the board. **Runenlegen** is
an unrelated board game at
`binaries/wep32-community/Runenlegen/Runenlegen.exe`.
The predecessor's `rg --files --hidden -g '!node_modules' -g '!.git' /home/user`
filename search found only its note/handoff. Arbitrarily named compilation
archives, other mounts and archive contents were not searched; the result
never proved universal media absence. It also confirmed the ordinary
schema-version-1 manifest route in both hosts and available shared helpers.
The present recovery resolves its media/pin/launch-plan unknowns above.
