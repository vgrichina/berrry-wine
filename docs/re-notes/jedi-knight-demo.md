# Jedi Knight: Dark Forces II original demo — source preflight

2026-10-15, owner `/root/new_game_refill_20261015`, proposed candidate
`jedi-knight-demo`. Source-only selection against main `729d3fc73675762407a5f45f425a70eb7186866b`.
The initial selection below preceded acquisition. The later acquisition section
supersedes its package/licence unknowns; no registration or guest run yet.

## Selection and provenance

The [preserved official LucasArts demo page](https://www.jkdf2.net/JKBot/JKArchive/JKDF2/JKDF2/Websites/Official%20Jedi%20Knight%20Website/Star%20Wars%20Jedi%20Knight%20Dark%20Forces%20II%20-%20Demo_files/demo_download.htm)
names `jedidemo.exe`, approximately 20 MB, as a self-extracting Windows 95
demo requiring DirectX 5 and supporting 3D accelerator cards. It describes
one single-player mission and one multiplayer level. Single player begins
at a fuel station while pursuing 8t88. This is the original Windows demo;
OpenJKDF2, other replacement engines and remakes are outside this lane.

Proprietary LucasArts demo, proposed local-only compatibility fixture. The
publisher's historical public demo offer establishes the intended trial
package, **not** permission to redistribute. Bundled licence terms remain
unread. The official `readme.doc` link now redirects to the generic Star Wars
games page; do not count that redirect as a licence review. Inspect the
original package's readme/licence before running any installer. No EULA has
been presented or answered in this lane.

Acquisition lead: [PCGamingWiki demo entry](https://community.pcgamingwiki.com/files/file/1308-jedi-knight-dark-forces-ii-demo/).
Its page was indexed but direct retrieval returned HTTP 403 during this
preflight. Another candidate mirror is [Frag-Net's original-game file list](https://frag-net.com/game_jk.html),
which lists `jedidemo.exe`; its exact download target and bytes still need
verification. Mirrors are leads, not authenticated package identities.
Package size, SHA-256, executable identity and extraction layout are unknown.

## No existing claim or qualification found

Case-insensitive searches for `jedi.knight`, `jedi.outcast`, `dark.forces`,
`jkdemo` in current `lib/apps.js`, corpus manifest, `TODOS.md`, append-only
messageboard and re-notes returned no entry. All-ref commit-subject searches
for Jedi/JKDF/Dark Forces also returned none. Filename search of local
`test/binaries`, `scratch` and `packages` found no Jedi/JKDF fixture. This is
a bounded search result, not proof about unavailable archives or saved boxes.
The title is absent from current `DESKTOP_APPS`, and no recovery recipe or
reviewed gameplay evidence was found. Existing Interstate '76 was rejected
as a refill candidate because its later re-notes record qualified gameplay.

## Exact next actions

1. After coordinator acquisition grant, resolve an original demo mirror and
   acquire only `jedidemo.exe` on the designated temporary box. Record source
   URL, retrieval time, bytes and SHA-256. List/extract the self-extractor
   without running it; inspect readme/licence and full file inventory. Do not
   download retail data, a source port or enhancement patch. Report an actual
   licence prompt if encountered; no acceptance is assumed.
2. Identify the original game PE and its dependencies from extracted bytes.
   Preserve all original assets and record hashes. Determine whether the
   package supplies a ready-to-run tree or needs its original installer;
   neither `JK.EXE` nor a particular directory layout is yet verified.
   Add a pinned recovery recipe and local-only registry entry only after
   those facts are established and relevant corpus checks pass.
3. With the separately serialized runtime grant, use the normal original
   executable, its ordinary New Game/player creation route and single-player
   demo mission. Prefer its Direct3D option if available; record the actual
   backend. Do not substitute another engine or skip game code. Use a bounded
   first launch and capture any actual startup blocker before further work.
4. Review an in-world screenshot, then use ordinary configured movement and
   release it. Compare stationary landmarks before/after input and capture
   the resulting world state. Save source/module/fixture identities, command,
   input transcript, images and cleanup receipt under one unique run folder.
   Only reviewed visible movement completes core qualification; menu, intro,
   render activity or successful extraction does not. Audio/FPS/public release
   remain independent scopes.

No runtime resource is owned. Shared HEAD/index and existing fixtures were
untouched; local free disk was about 2.4 GiB before the sparse notes checkout,
with a 2 GiB floor. Acquisition is planned remotely to preserve that floor.

## Acquired and extracted, 2026-10-15 13:15 UTC

Coordinator granted acquisition/extraction on `bx_9ef2wdsw`, separately from
guest execution. Archive metadata at `https://archive.org/metadata/jedi-knight`
lists `jedidemo.exe`, 21,195,858 bytes, SHA-1
`ed285053d8c267b5fe9aa1ec5728fa37936b3689`. The normal download URL returned
HTTP 500; the metadata-listed mirror succeeded:
`https://ia801506.us.archive.org/0/items/jedi-knight/jedidemo.exe`.
Actual bytes matched that size/SHA-1; SHA-256 is
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.

The Win16 InstallShield self-extractor holds 39 concatenated single-file ZIP
records. 7-Zip sees only the first and reports headers error; unzip sees the
last. `tools/extract-jedi-knight-demo.js` pins the full package SHA-256,
validates every deflate output size and CRC, rejects unsafe/duplicate names,
and writes all records into a new output directory. Actual remote extraction
passed: **39 files, 40,812,035 bytes**. The complete original inventory is
[`jedi-knight-demo-inventory.json`](jedi-knight-demo-inventory.json).

Remote recovery paths, all under `/home/user/jedi-knight-demo-preflight-20261015`:
`source/jedidemo.exe`, `source/archive-metadata.json`, `extract.js`, `original/`,
`original.inventory.json`. Local evidence is
`scratch/runs/20261015-jedi-knight-demo-preflight/` (inventory, original licence
text, remote read receipt). No installer or game ran. Existing remote paths
were preserved.

`original/License.txt` was read. It permits free copying and electronic
distribution of the unchanged original demo, prohibits charging for it, and
restricts modification/reverse engineering except as allowed by law. Ordinary
local compatibility use is the lane; this is not public deployment approval.
The licence states that use binds its terms; no interactive acceptance was
presented or answered. No executable disassembly was performed.

`jkdemo.exe` is the original PE32 game (1,388,032 bytes, SHA-256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`).
The package also contains `Jedi.exe` launcher, `SMACKW32.DLL`,
`jk1demo.gob`, `jk1mpdemo.gob`, `res1demo.gob`, and the original installer.
The extracted flat tree is **not yet an installed-game layout**.

The original Word readme's printable text confirms: Launcher Play → create
player name/difficulty → Main Menu → Single Player. Configure Setup/Display
for 3D before entering the mission. Defaults are W forward, S backward,
A/D sidestep, left/right arrows turn, Space activate and X/right mouse jump.
The document describes a real single-player fuel-station mission.

Next: separately granted bounded original installer/launcher run to establish
the game's normal installed directory/registry contract. Preserve any actual
licence screen unanswered. Only then register the observed working original
route and capture normal player-controlled gameplay. No registry assumptions,
replacement engine or direct-to-level bypass are justified by this extraction.

## Original setup first run: blocked before visible installer

Separately granted runtime `116272`, `2026-10-15T13:19:39.244Z` to
`13:19:40.009Z`, launched original `setup.exe` with all 39 files mounted,
300-second guest and 360-second controller limits. No input was sent.
The original Win16 setup invoked `C:\WINDOWS\TEMP\_INS0432._MP` via WinExec;
thread 1 subsequently exited and the host reported `window cleanup failed:
unreachable`. Parent Exit(0) followed after 602 batches. This is an observed
installer failure, not proof of a particular cause. No installation, licence
screen, main menu or gameplay was observed. Reviewed final PNG is plain teal.

Source is exact tree `42c76ec08136d55337151f7c8156a18fb3f6a618` of
`cca0eb4067b454576a6282677cabd4db8b169610`. The temporary checkout's shallow
HEAD is `03641536b256ec78527fee514ea2dfa4c31639e4`; applying the retained
source delta with `git apply --index` produced the exact candidate tree, and
`git diff-files` was empty. A bundle import first refused a missing historical
prerequisite; no guest ran until exact tree identity was verified. WAT/compiler/
build inputs match donor 03641536, and physical canonical module SHA-256 is
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
All tracked source hashes plus 39 original fixture hashes were unchanged
after execution. Actual 32×32 PNG/renderer preflight passed. Process inventory
at `13:20:11Z` found no surviving guest/browser/build/controller processes.

`tools/jedi-knight-first-launch.js` preserves the exact controller. The
recovered evidence archive is 333,438 bytes, SHA-256
`d6877ad2b7da4f5e0c90b3e81991c717314e7bf9bc36113731db5db59b4e0764`;
local `scratch/runs/20261015-jedi-knight-demo-preflight/setup-run/` contains
launch/identity/source manifest, log, final image, terminal and postflight.
No corpus `result.json` was published because no candidate is registered.
Runtime released to coordinator. Next is source-only inspection of the
existing installer-child execution path, or a documented original launcher
route once its installed layout is established; do not fabricate registry
state or classify this demo as qualified.

### Source-only handoff after runtime release

The earlier log marker `0xb0071612` is more specific than the later cleanup
warning: `src/09e-win16-api.wat` emits it when `$win16_winexec_task` gets
`<= 0` from `$host_win16_stage_module`. That path then returns failure to its
caller. The current CLI's base `shell_execute` logs and returns 33; its
`--capture-launch=DIR` hook is the existing mechanism for preserving a
bootstrap installer's original generated child before temporary-file cleanup.
The warning in `ThreadManager._markThreadExited` is caught while destroying
the exiting thread's windows; it does not establish why the child failed.

Exact next ready task, requiring a fresh serialized runtime grant: repeat the
ordinary original setup with `--capture-launch=<fresh-dir>`, `--save-vfs`,
and `--reg-export` so the installer-created `_INS0432._MP` and its genuine
arguments/cwd survive. Review the resulting `launch.json`, file identities and
first-stage log. Then form a normal second-stage `--exe` command from the
receipt, mount the capture with `--vfs-tree`, and use its actual `--cwd`,
`--args`, and `--exe-guest-path` as appropriate. There is no assumed `--launch`
flag. Keep all original supporting files and stop at any licence screen.
This is the documented bootstrap handoff, not guessed registry state or a
direct-to-level bypass. No follow-up run occurred in this worker after release.
