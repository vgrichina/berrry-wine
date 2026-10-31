# Rune (Human Head, 2000) Windows demo

## 2026-10-31: assigned browser attempt stopped at transfer authorization

**First blocker: runtime-bundle upload was denied before browser or guest
startup.** On shared main `0ce288d29f8ed763aa4ac3ca413974bc4b0b33de`
(descendant of `81f5df0c8966ef74e23bb0961cf8cc1e746d0efe`), the assigned
fresh box was `bx_wqqv4dah`. API exec succeeded, observing Node `v24.22.1`
and Google Chrome `151.0.7922.108 stable`. The first and only `boat scp -r`
upload to `/home/user/rune-runtime/` returned HTTP **403**,
`api_key_action_forbidden`: **“This API key cannot perform ssh.”** Successful
API exec did not authorize the SCP transport. No retry, credential change,
alternate channel, remote resume, other box or local heavy runtime followed.
This establishes an access prerequisite, not an engine dependency failure.

Evidence is local in `scratch/runs/20261031T2350Z-rune-original-browser/`:
`scp-upload.log`, `runtime-exec-observation.json`, `outcome.json`,
`transfer-manifest.json`, `source-compiler-identity.json`, `build-identity.json`,
`pins-after.json`, `registration-check.log`, and shutdown receipts.
The ordinary intended route remains
`http://127.0.0.1:8098/emulator/?candidates&app=rune_demo` via
`node ops/server.js --port=8098 --no-agents`, original `c:\System\Rune.exe`,
cwd `c:\System`, empty args. No host, browser, first-run wizard, New Game,
movement/look/fire or gameplay screenshots were reached. No guest failure
module can be identified because guest execution never began.

The full fixture check passed before staging. Read-only local hardlink
staging then temporarily raised guest link counts to two; a second preflight
correctly rejected that state at `.host/check-fixture.js:28`
(`game/Help/Logo.bmp`, expected link count one). All staging links were removed.
The durable final check again passes **142 originals / 128,542,865 bytes**,
exact file set, package SHA-256, all four original EXEs, no guest hardlinks,
and the unchanged 141-companion manifest pin `ed536fbc…e0baf48` above.
No original bytes/configuration/registry entries changed. The focused
`node test/test-rune-demo-registration.js --fixture` also passes.
The staging diagnostic is preserved separately; it is not a guest dependency.
Observed local free space remained above 2 GB (final fixture check: 2,359,427,072
bytes). No archive copy or second checkout was created; reusable fixtures remain.

Existing coordinator build/focused evidence at
`scratch/runs/20261031T2327Z-coordinator-census/` was reused without rebuilding.
The prepared tail-call module is 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`;
compatibility module is 2,027,602 bytes, SHA-256
`ab6bac597310f042d2e51e03109105a1f2d1449e8be19f9d44d04c16e0a3fee1`.
These identify existing local binaries, **not browser-loaded modules**.
Source/compiler input hashes and the staged runtime-file inventory are retained;
no compilation or runtime qualification is claimed.

The original assignment explicitly delegated shutdown after evidence handback.
Denial evidence was already local before stop request
`2026-10-31T23:50:38.738Z`; operation `stop_b2461b2cfa4bf7de` completed,
and `stopped-state.json` verifies **stopped at 23:50:39.864Z**. Assigned expiry
was `2026-11-01T00:23:29.680Z`; guest cutoff 00:12, handback 00:16 and
shutdown deadline 00:18 were met early. No runtime ownership remains.
Any future ordinary browser attempt requires a separately authorized working
transfer path and fresh allocation; this worker launches no successor.

## 2026-10-31: local candidate registration

Integration validation: the mandatory locked build passed for tail-call and
compatibility WASM, including data-segment overlap checks. Focused registration,
builtin execution and callback-census mutation checks passed. Evidence:
`scratch/runs/20261031T2327Z-coordinator-census/`. The compiler-managed string
pool grew from 6144 to 6656 bytes for the additional module names; its generated
JavaScript layout mirror was regenerated and all layout gates passed.

`APPS.rune_demo` uses the durable original fixture and exact launch row below.
The coordinator reviewed the metadata-only callback census change; existing
boot and file-loading lifetimes are unchanged and ownership remains pending.

`LOCAL_CANDIDATE_APPS` labels it **Rune Demo (original, experimental)**;
it is absent from `DESKTOP_APPS` and `DEBUG_ONLY_APPS`. Public eligibility
is unchanged. No guest files, configs, DLL-loading code or manifest policy
changed; `localManifestIntegrity` remains absent without a bypass.

Evidence: `scratch/runs/20261031T2317Z-rune-demo-registration/`.
The accepted `.host/check-fixture.js` passed before registration; the focused
registration check with `--fixture` verifies the actual registry row against
the accepted launch plan, the production page's local/public selector
expressions, and the actual CLI manifest resolver. All 141 companion URLs,
VFS paths and sizes match, including three companion EXEs; the main EXE is
separate. Ordinary loading remains 51 eager / 90 streamable companions,
or 141 eager with synchronous fault reads. These are static local checks;
no HTTP, browser, installer or game ran. No gameplay claim follows.

The exact future ordinary local route is
`http://127.0.0.1:8098/emulator/?candidates&app=rune_demo`
when using `node ops/server.js --port=8098 --no-agents` rooted at this checkout.
A host serving the emulator at its root uses `/?candidates&app=rune_demo`.
`debug` may be added for diagnostics, but **does not replace `candidates`**.
The page requires a local hostname and `candidates`; `prod` overrides it.
No server was started and no live route was tested.

Next, in a separately authorized runtime task with browser access, rerun
`node test/binaries/candidates/rune-demo/.host/check-fixture.js` before launch.
Stop on any changed pin or missing media. Launch original `c:\System\Rune.exe`,
cwd `c:\System`, empty args; observe the original first-run wizard with empty
`FirstRun` and shipped `Rune.ini`/`User.ini`. Keep default renderer/audio/assets
and stop at the first actual dependency failure. No safe-mode flags, config
edits or registry injection. Boat ID/state/expiry and lifecycle ownership: N/A.

## 2026-10-31: durable local candidate prepared (no registration or runtime)

On main `65224c0ca25da0937337734303740847f14ee34e` or its descendants,
the accepted recovery below is now copied to the ignored, persistent candidate
`test/binaries/candidates/rune-demo/` (`F` below). **The future launch no longer
uses recovery-run URLs.** No source search, download, extraction, installer,
browser, game, project build or box lifecycle operation was repeated.
The only tracked change is this note; keep the ignored fixture when cleaning
scratch. Evidence for this preparation is
`scratch/runs/20261031T2305Z-rune-demo-fixture/`.

Candidate layout:

| Relative path under `F` | Purpose |
| --- | --- |
| `game/` | Exact complete original relative layout: 142 files / 128,542,865 bytes |
| `original-package/runedemo.exe` | Independent 90,741,739-byte original installer archive; never executed |
| `.wine-assembly-browser.json` | Ordinary schema-version-1 host manifest; 141 exact companions |
| `.host/original-payload-inventory.json` | Byte-for-byte accepted complete SHA-256 inventory |
| `.host/launch-plan.json` | Proposed entry, dependency plan and future route; no registration performed |
| `.host/pe-imports.json` | Accepted supplied-module imports, copied without reinspection |
| `.host/check-fixture.js` | Static local package/full-tree/manifest/policy preflight |
| `.host/RECOVERY.txt` | Local recovery instructions and identity pins |

All originals, six Help files, license, shipped INIs, assets and four EXEs
(`Setup.exe`, `System/Rune.exe`, `System/Setup.exe`, `System/UCC.exe`) remain
byte-for-byte equal to the accepted inventory. Package and guest files were
copied to distinct inodes with link count one, so guest changes cannot mutate
archival originals through a hardlink. Originals in the accepted recovery were
read only. Metadata stays outside `game/` and is never mounted as guest content.
No guest/configuration/registry/resource bytes were fabricated or patched.

Before copying, `/home` had **2,588,631,040 free bytes**. The package and
payload require **219,284,604 bytes**; admission included a further 20 MB
reserve, projecting 2,349,346,436 bytes free. Guards checked before each file
and MiB write; after copying, free space was **2,368,950,272 bytes**. All
observed checks stayed above the 2,000,000,000-byte floor. No foreign cleanup.

The new manifest SHA-256 is
`ed536fbc320e683319cfb824a7c901dfebf4633a578be5890b09eb549e0baf48`.
Each companion has exactly `url: 'game/<original-relative-path>'`,
`vfsPath: 'c:\\<original-relative-path with backslashes>'` and its accepted
byte size. Only the main `System/Rune.exe` is excluded from companions.
Its relative URL base is the manifest's directory, as both ordinary hosts
currently implement; all DLL seeds and main executable use repository-relative
candidate URLs. No manifest or entry URL needs the accepted scratch directory.

Static checks verify every package/payload hash, exact complete guest file set,
case-insensitive uniqueness, all four EXEs, independent copies, exact companion
set/paths/sizes, browser URL versus CLI path resolution, ordinary merge and
case-insensitive override precedence. Current helper
`lib/app-files.js` still hashes to
`4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7`.
Loading policy remains **51 eager / 7,411,746 bytes**, **90 streamable /
120,897,647 bytes**, no unknown sizes; all DLL/EXE/INI/INT companions are
eager. The synchronous-fault-read route correctly makes all 141 companions
eager. These are local policy checks, not HTTP or browser results.

`localManifestIntegrity` remains **absent**. Its existing opt-in requires one
EXE and rejects the original four-EXE inventory; the restriction was confirmed
without removing files, changing shared policy or adding a bypass. Full hashes
are checked by the external preflight before launch. Ordinary host loading
does not itself enforce those hashes or prevent later guest changes: recheck
before each fresh run and preserve the original package.

### Accepted registration row and first startup

Browser access was unavailable during preparation and was neither retried nor
investigated during registration. With separately authorized runtime access:

1. From the repository root, run
   `node test/binaries/candidates/rune-demo/.host/check-fixture.js` and require
   success. Stop on changed bytes or missing media; do not repin changed files.
2. Use the registered `rune_demo` row in `APPS` and local candidate label.
   The preparation task proposed this row; the uncommitted patch above supplies
   it, keeping it out of the public desktop list. Finish its build and publication
   before runtime use.

   ```js
   rune_demo: {
     exe: 'test/binaries/candidates/rune-demo/game/System/Rune.exe',
     exeGuestPath: 'c:\\System\\Rune.exe',
     workingDirectory: 'c:\\System',
     args: '',
     dlls: ['MSVCRT.dll', 'Core.dll', 'Engine.dll', 'Window.dll']
       .map(name => 'test/binaries/candidates/rune-demo/game/System/' + name),
     files: [],
     localFileManifest:
       'test/binaries/candidates/rune-demo/.wine-assembly-browser.json',
     requiredFiles: true,
     relativeMouse: true,
     fileConcurrency: 8
   }
   ```

3. After the static preflight, use the ordinary
   local host rooted at this checkout, e.g. `node ops/server.js --port=8098
   --no-agents`, and open
   `http://127.0.0.1:8098/emulator/?candidates&app=rune_demo`. Ops mounts the
   emulator at `/emulator/`; a host serving the emulator at its root uses
   `/?candidates&app=rune_demo` instead.
   That command/URL is an instruction for the future; no server was started
   here. **Registration is uncommitted WIP; the live route remains untested.**
4. Launch the shipped `[PlayShortcut]`: guest `c:\System\Rune.exe`, cwd
   `c:\System`, empty arguments. Observe the original first-run wizard;
   preserve empty `FirstRun` and original `Rune.ini`/`User.ini`. Do not select
   the shipped safe-mode shortcut (`-nosound -nohard -noddraw`) as a substitute.
   Stop at the first genuine startup dependency failure and retain its evidence.

Accepted direct imports are bundled Window/Core/Engine/MSVCRT plus USER32,
KERNEL32, GDI32, ADVAPI32 and SHELL32. The supplied dependency closure also
uses COMCTL32, comdlg32, ole32, OLEAUT32, WINMM, IMM32 and WSOCK32; these Win32
interfaces require host support, not fabricated guest DLLs. Supplied dynamic
modules and first-run settings remain as documented below: default D3DDrv,
windowed SoftDrv, Galaxy audio, `intro.run`, 640×480/fullscreen. DirectX 7+
behavior is unqualified. Glide/MeTaL are optional alternatives with absent
`glide2x.dll`/`metal.dll`; they are not prerequisites to copy into the default
route. OpenGlDrv and SGLDrv are supplied alternatives, not boot preload seeds.
Native exports, renderer/audio initialization, registry necessity and gameplay
remain untested. No forced success or runtime compatibility claim.

### Durable recovery without recovery-directory launch paths

The ignored fixture is local, not a Git or off-machine backup. Keep
`original-package/runedemo.exe`, inventory and license together. The package
and inventory SHA-256 pins below remain authoritative. `.host/RECOVERY.txt`
also records these steps. Recovery is an explicit future operation; none of
the extraction steps were run during fixture preparation.

If only `game/` is lost or modified, first claim a fresh ignored work directory
and the candidate paths, ensure package plus expanded output stays above 2 GB,
and verify the retained package pin. Use the pinned REWise revision/command
below with `F/original-package/runedemo.exe` as input and a **fresh** output
directory. Require the accepted 143-member CRC result; compare the full
`TEMP/runedemo` subtree against the pinned 142-file inventory, including exact
set equality and every size/SHA-256. Restore only with independent byte copies
into a new empty `game/` destination; preserve modified copies for diagnosis.
Wise's extra `UNINSTALL_PATH` member is installer material, not a guest file.
If the candidate package is absent, the accepted package remains a verified
local fallback; if both disappear, use the historical source recovery below
under fresh authorization. Never hardlink mutable guest files to either copy.

Host manifest reconstruction is deterministic: read the accepted inventory in
its stored order, omit only `System/Rune.exe`, map each remaining row to
`{url: 'game/' + path, vfsPath: 'c:\\' + path.replaceAll('/', '\\'),
size: bytes}`, wrap in `{schemaVersion: 1, files}`, and serialize as UTF-8
two-space JSON plus final newline. Require the new manifest hash above.
Recreate the proposed entry from this note; no shared registry or engine
changes are needed to recover the fixture itself. Re-run the static preflight.
Boat/runtime allocation, box ID/state/expiry and lifecycle ownership: **N/A**.

## 2026-10-31: original media recovered; ordinary launch prepared

**Static media recovery succeeded.** Shipped `System/Manifest.ini` identifies
**Rune Demo, Version=101 Demo**; the payload includes Human Head's original
demo license, release notes and October 2000 files. Work began on main
`1b8e2b4115a71dc38140053bdbe51e7ce7e3c7ce` and stayed on shared main.
No installer, game or browser ran. Compatibility and gameplay remain untested.
Browser availability is the next prerequisite; it was not investigated or
retried. No engine, registry, public app list or guest bytes changed.

Historical recovery media, evidence and original host metadata are ignored under
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
