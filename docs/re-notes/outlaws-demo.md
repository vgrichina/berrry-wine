# Outlaws original Windows demo — source readiness

Task: `NEW-GAME-OUTLAWS-DEMO-20261015`.

Audited 2026-10-15 by `/root/new_game_refill_after_kkrieger` against
`origin/main` d001064bf3cfab6808f7dc3646718667da3b8679. Source-only refill
for the standing two-new-game pipeline. No package downloaded, executable
inspected, installer run, licence answered, or gameplay qualified in this task.
Acquisition and runtime require separate coordinator grants. Main integration
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

## Next bounded acquisition task (not executed)

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
