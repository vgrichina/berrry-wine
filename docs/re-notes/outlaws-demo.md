# Outlaws original Windows demo — verified acquisition

Task: `NEW-GAME-OUTLAWS-DEMO-20261015`.

Initial source audit 2026-10-15 by `/root/new_game_refill_after_kkrieger` against
`origin/main` d001064bf3cfab6808f7dc3646718667da3b8679. Source-only refill
for the standing two-new-game pipeline. No package downloaded, executable
inspected, installer run, licence answered, or gameplay qualified in this task.
That initial audit did not acquire bytes; the completed acquisition below supersedes
its unknown package identity. Runtime still requires a separate grant. Main integration
of these notes is a coordinator action.

## Selection and provenance

Selected **Outlaws (LucasArts, 1997), updated original single-player demo**.
`git grep -n -i outlaws origin/main` returned no matches, including public
`DESKTOP_APPS`, candidate corpus, TODOs, and investigation notes. Shared copies
of those files and handoffs also had no match. `git log --all` searches for
Outlaws commit subjects and the two plausible re-note paths found no history.
This is a new title relative to that observed repository coverage; these
negative checks do not assert knowledge of unrecorded external experiments.

The primary publisher document is the [LucasArts Archives III Quick Start
Guide](https://www.mocagh.org/lucasfilm/lucasartsarchives3-refcard.pdf), printed
pages 8–9 (PDF pages 8–9, zero-based 7–8). Its Super Sampler 2 section describes
Windows 95, DirectX, an Outlaws demo installation screen, single-player versus
single-plus-multiplayer choices, and the installed demo launcher. The launcher
provides play, readme, troubleshooting, sound/video configuration, and video
mode selection. This establishes an original publisher demo and normal route;
it does **not** establish that the separately archived updated download has
identical installer packaging.

[Paleface's historical demo page](https://paleface.net/filedemos.html) links
its 13.5 MB single-player demo directly to
`ftp://ftp.lucasarts.com/demos/pc/outdemo_v2.exe`. That exact link was read from
the HTML on 2026-10-15 (the browser text rendering omits FTP links). The page
describes one Sanctuary level and lists multiplayer and retail patches
separately. This is a historical third-party pointer into the publisher's
domain, not a freshly validated publisher download or byte-authenticity proof.

The [Internet Archive item](https://archive.org/details/outdemo_v2) and
[metadata endpoint](https://archive.org/metadata/outdemo_v2) identify the item
as Outlaws Demo, creator/publisher LucasArts, 1997, and describe the updated
single-player version with optional 3Dfx graphics, Aureal sound and an alternate
multimedia sound driver. These are archive metadata claims, not measured API
requirements. Read-only metadata and HEAD observations at 13:48 UTC:

| Field | Observed value |
| --- | --- |
| Package | `outdemo_v2.exe` |
| URL | `https://archive.org/download/outdemo_v2/outdemo_v2.exe` |
| Size | 14,186,356 bytes |
| Metadata SHA-1 | `5568d44da014b6be21d105b1149ec022c10c0655` |
| Metadata MD5 | `ccd7678d2276fe1b39cef399598d4a6d` |
| Metadata source/format | `original` / `Windows Executable` |
| HEAD | HTTP 200; Content-Length 14186356 |
| HEAD final URL | `https://dn711100.ca.archive.org/0/items/outdemo_v2/outdemo_v2.exe` |
| HEAD Last-Modified | Sun, 19 Jan 2014 22:45:26 GMT |
| SHA-256 / downloaded-byte verification | Unknown; no package GET performed |

The archive's `original` field describes upload lineage, not a publisher
signature. Do not use archive screenshots as Wine-Assembly evidence. Other
search results named `oldemo.exe`, a modern Windows batch wrapper, retail
updates and full-game uploads; none is the selected artifact. No alternate
engine, remaster, retail disc, patch or replacement DLL is part of this lane.

## Initial bounded acquisition plan (completed below)

Owner: coordinator-assigned acquisition worker after an explicit grant. Use
an isolated remote directory, preserve this host's free-space floor of 2 GiB,
and initially reserve 256 MiB remotely. Do not acquire a full sampler ISO.

1. Save fresh metadata and response headers with retrieval UTC and final URL.
   Download only the exact 14,186,356-byte package above, bounded to 120 seconds
   and 20 MiB. Reject HTTP/error pages, unexpected size, or either metadata
   digest mismatch. Record computed SHA-256 as the recovery pin and retain the
   original immutable package. An example acquisition command for the granted
   remote directory is:

   ```sh
   curl --fail --location --max-time 120 --max-filesize 20971520 \
     --dump-header outdemo_v2.headers \
     --output outdemo_v2.exe \
     https://archive.org/download/outdemo_v2/outdemo_v2.exe
   sha256sum outdemo_v2.exe
   sha1sum outdemo_v2.exe
   md5sum outdemo_v2.exe
   stat -c %s outdemo_v2.exe
   ```

2. Inspect PE/container identity and list members without executing. Discover
   the actual package format before choosing an extractor. Bound listing and
   extraction to 60 seconds each; reject traversal/absolute member paths and
   halt if declared expanded content exceeds 256 MiB. Do not guess an
   InstallShield format or reuse Jedi's extractor on filename similarity.
3. Read the original readme/help/licence and setup metadata. Record version,
   actual executable names, arguments, working directories, asset paths,
   required registry values and default controls. Inventory every original
   payload file with SHA-256. `OLWIN.EXE` is only a search lead until confirmed
   by this package; there is currently no registered app ID or launch command.
4. Determine whether original installation is required. Static extraction
   alone does not prove installed registry/configuration. Preserve the normal
   launcher path. If setup generates a child, capture its actual bytes,
   arguments, cwd, VFS and registry rather than inventing installed state.
   Stop at any licence choice; do not supply an automatic acceptance.
5. Commit the verified recovery recipe, inventory and original readme-derived
   launch instructions. Only then prepare nonpublic candidate registration
   under a distinct proposed ID `outlaws-demo`. Keep binary assets ignored.

Acquisition done criteria: exact package digests verified, original readme
reviewed, reproducible bounded extraction/installation plan, full payload
inventory, and explicit unresolved launcher dependencies. A failure to obtain
these is an acquisition blocker, not an emulator regression.

## Later runtime proof criteria (not granted)

After acquisition review, obtain the serialized temporary-box runtime slot;
IW and Jedi currently own the runtime queue. Begin with a bounded 120-second
ordinary original setup/launcher observation with no licence input. Record
source tree, compiled module and fixture digests, process result and cleanup.
Choose the original default software/video path if the package offers one;
do not add retail graphics updates or wrappers to make a launch succeed.

Gameplay qualification requires the actual demo level, ordinary menu/input
navigation, an idle baseline followed by held/released movement and turning,
and a visibly changed player view attributable to those inputs. Confirm key
release and retain a reviewed full-frame gameplay screenshot with run/source
identity. Read controls from the acquired original documentation before
programming input. A menu, attract sequence or archive screenshot is not
player-control proof. Retain failures, hashes and cleanup receipts under a
unique `scratch/runs/` directory; write `result.json` last under the ops capture
convention. Report frame rate, audio, combat, save/reload and session stability
separately, and leave each unmeasured property unknown. No public deployment
or redistribution follows from source readiness or runtime success.

Validation of this document: source URLs/HTML and archive metadata inspected,
HEAD length matched metadata, current-main coverage and history searches
completed, and `git diff --check` passed. There was no local fixture creation,
build, browser, VM or runtime test.

## Verified acquisition, 2026-10-15 13:56–13:58 UTC

Owner `/root/outlaws_original_acquisition`, branch
`task/outlaws-original-acquisition`, source base `b5a7e11db`.
Jedi owner explicitly released process 141587 after exit 0 and postflight
13:55:49.897Z. Independent receipt read and fresh process inventory at
13:56:21.859Z found no active game/build/browser before acquisition.

The exact package downloaded in about 3.5 seconds on `bx_9ef2wdsw`:

| Field | Verified value |
| --- | --- |
| Bytes | 14,186,356 |
| SHA-1 / MD5 | Both match the table above and fresh metadata |
| SHA-256 | `501f37aa475b6c27c87ce04e30b5207f91b81603cb376aaa9ffde1647a40e7b3` |
| Container | ZIP self-extractor, 22,255-byte PE32/i386 stub |
| Payload | 31 members, 23,300,090 expanded bytes, every CRC verified |
| Preserved remote directory | `/home/user/outlaws-original-acquisition-20261015` |
| Payload directory | `payload/` within that directory |

`7z l -slt` identified ZIP and listed members before extraction. The hash-pinned
extractor validates all paths, encryption/symlink flags and expanded size before
writing a new directory, and never executes the SFX. All 31 original records,
including CRC, SHA-256 and PE identity where applicable, are in
[`outlaws-demo-inventory.json`](outlaws-demo-inventory.json).
`WDIRNOP.COM` and `wdirnop.com` are identical five-byte files with identical
SHA-256. Both remain preserved on the case-sensitive host; a later Windows VFS
manifest must map that equivalent case-insensitive name once, with the duplicate
explicitly recorded. No original member was changed or removed.

### Original documentation and normal launch

`readme.txt` is README V7.0; `ol.ver` says `DEMO 1.1W, Build 1`.
The original README explicitly instructs creating a directory (example
`C:\OUTDEMO`), extracting the downloaded self-extractor there, then opening
`OLDEMO.EXE`. This download does **not** require the CD sampler's installer or
launcher. No command-line arguments are documented. The next ordinary launch
is therefore `C:\OUTDEMO\oldemo.exe`, empty arguments, cwd `C:\OUTDEMO`, with
the complete original payload available beside it. `OLWIN.EXE` is absent.

The actual game is `oldemo.exe`, 1,298,944 bytes, SHA-256
`46b72a094e891494cfa8f411d1942ea9dd7f06151d28f2af4bc1c1dca1e4ec79`,
PE32/i386, six sections, image base `0x400000`, entry RVA `0xf10d0`.
Original configuration executable `olcfg.exe` is 64,512 bytes, SHA-256
`52cab1f49d16e3c9b58455a9101e1c788c62088c2826d432e4631f23a1c22d79`.
Assets include `outlaws.lab`, `start.san`, `end.san`, and the supplied DLLs.

README requirements include Windows 95, Pentium 60, 16 MB RAM and DirectX 3.0a.
`regpatch.lst` declares Demo Default display driver `LECDDRAW.DLL` and sound
driver `LECDSND.DLL`. It is package data, not permission to fabricate registry
state. There is no separate registry installation instruction in the README;
actual initialization and configuration writes remain unobserved.
Start with the original default path and clean guest state. Resolve failures
from actual loader/API evidence rather than installing replacement DLLs.

`Outlaws.doc` is a Word 95 troubleshooting guide, decoded using `catdoc` without
running Office. It describes `OLCFG.EXE` display and sound selection, including
320×200 DirectDraw, original Window display mode and MGL alternatives.
Window mode recommends an 800×600 16-bit desktop and documents no mouse control
in that mode. Alternatives require later ordinary UI observation, not patched
configuration. DirectDraw is the first/default path; no Glide dependency is
assumed merely because optional original Glide DLLs are present.

Default controls from the README: Up moves forward, Left/Right turn,
Shift runs, Space nudges/opens doors, X jumps, C crouches, Ctrl fires,
R reloads and Escape opens options. The README labels Down as "Move Down";
its actual behavior is untested. Do not substitute WASD without observing
the in-game configuration. Later movement proof should use held/released Up
and Left/Right with an idle baseline and retained screenshots.

The README includes the original licence: original-form noncommercial copying,
restrictions on modification and reverse engineering subject to applicable
law, and warranty/liability terms. This is a record of the included text,
not a legal conclusion or an acceptance action. No licence UI was encountered
or answered, and no guest executable was run.

### Recovery and next prerequisites

On a granted remote host with Node, 7z, curl and file, choose a **new**
absolute directory and run the committed recipes:

```sh
node tools/acquire-outlaws-demo.js /home/user/outlaws-recovery-UNIQUE
node tools/extract-outlaws-demo.js /home/user/outlaws-recovery-UNIQUE/outdemo_v2.exe /home/user/outlaws-recovery-UNIQUE/payload
```

The acquisition recipe enforces 120 seconds/20 MiB for the package and fresh
metadata identity; extraction uses JavaScript validation and inventory around
7z listing, CRC testing and extraction, with a shared 60-second deadline and
256 MiB expanded bound. JavaScript independently checks each extracted CRC,
size, SHA-256 and PE identity. Recovery must compare the generated inventory against the committed
inventory before launch. Do not overwrite this run or retain fixtures locally
where they would break the 2 GiB free-space floor.

Compact receipts live in shared
`scratch/runs/20261015-outlaws-original-acquisition/receipts/`: fresh metadata,
headers, acquisition/list/extract receipts, full original README and decoded
troubleshooting text, inventory, and postflight. Original package and all bytes
remain remote. Postflight at 13:58:35.923Z verifies all 31 payload hashes and
package SHA-256 unchanged, active process inventory empty; acquisition slot was
released to the coordinator. These are acquisition receipts, not runtime or
dashboard gameplay evidence.

Next prerequisite: review this identity/route and prepare a nonpublic complete
VFS candidate manifest (no app registration was added here), pin a matching
source/module, then obtain the serialized runtime grant for a bounded ordinary
`oldemo.exe` first launch with no initial input. Stop on any licence choice.
Runtime compatibility, registry/config initialization, menus, gameplay, audio,
frame rate and control release all remain untested. Syntax and diff checks
passed; the actual hash-pinned extraction and CRC/size/hash inventory succeeded.

Recipe correction: the initial 13:57 extraction used an embedded Python ZIP
reader, contrary to the JavaScript-only script requirement. That historical
script and receipt remain preserved remotely and in Git history. The current
recipe is JavaScript plus the existing 7z CLI. Do not treat the historical run
as execution of the corrected recipe.

Corrected recipe `baa9fcdd1b383171fde0f152e36b433506c81bfe` was independently
verified after the IW owner's release: IW's 14:09:24.467Z postflight retained
unchanged source/donor and no active processes, fresh inventory at 14:09:57.373Z
was empty, and PID 148227 was absent from current Boat `ps`. The extractor ran
14:10:36.660–14:10:37.508Z into the new `payload-js-verified/` directory beside
the preserved original payload. All **31 complete inventory records** matched
the committed inventory exactly, including CRC32, SHA-256 and PE identity.
Postflight at 14:10:55.195Z independently rehashed both payload copies and the
immutable package, verified no active processes, and released the acquisition
slot. No guest, browser or build was run.

The exact corrected script is preserved remotely as
`extract-outlaws-demo-js-verified.js`; `js-verification.json`,
`payload-js-verified-inventory.json` and `js-postflight.json` retain the result.
Compact local receipts include `js-verification-api.json`, `js-postflight.json`,
`js-prior-release.json`, `js-preflight-inventory.json` and
`js-release-handle.json` (the last records absence from live process inventory,
not an independently recovered historical exit code). The ordinary launch
recipe and all untested runtime prerequisites above remain unchanged.
