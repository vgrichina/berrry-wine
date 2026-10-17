# Army Men (1998) original Windows demo: source preflight

Task `NEW-GAME-ARMY-MEN-DEMO-20261015`; owner
`/root/new_game_refill_after_jedi`; observed 2026-10-15 14:00 UTC.
This refills the lane held on Jedi Knight's unanswered licence prompt.
Next: acquire and identify the archived demo on the coordinator's authorized
remote host after its current owner releases it. No package bytes, installer,
game, build, browser, or licence input were executed for this preflight.

## Selection and coverage

At base `b5a7e11db85b4a1e9a383fee6bafebdd096baea7`, case-insensitive searches
for `army.?men|desperados` found no match in `lib/apps.js` (including
`DESKTOP_APPS`), `TODOS.md`, `docs`, `ops`, or the candidate corpus. Shared
messageboard search and all-ref subject/path history searches likewise found
no existing Army Men qualification or owner. Desperados was considered but
not claimed: Army Men has a smaller available archive with a published digest.
This is the first Windows Army Men, not Army Men RTS, a console version,
source rebuild, replacement engine, or an already-qualified title.

The [archive's catalogue](https://archive.thedatadungeon.com/army_men_1998.html)
identifies The 3DO Company as developer/publisher and labels the distribution
1998-09-14, Demo, Microsoft Windows. This is archive metadata, not proof of
the executable's internal version or publisher authenticity. Original package
readme, copyright/version information, licence, and game executable remain
uninspected. Acquisition must confirm them before registration or execution.

Excluded lead: Internet Archive item `army-men-beta-demo` describes its copy
as second-hand and possibly leaked to a BBS. Do not substitute that February
1998 beta or the separately indexed source-code collection.

## Exact source and recovery pins

Archive directory:
<https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/>

| Observation | Value |
| --- | --- |
| Package | `a.zip` in the directory above |
| HEAD response | 200, `application/zip`, `Accept-Ranges: bytes` |
| Content-Length | 18,373,265 bytes |
| Last-Modified | Tue, 28 Aug 2018 17:26:31 GMT |
| ETag | `"1185a91-57482249458e0"` (not a content digest) |
| Archive-published SHA-256 | `dd1faca49d6e5adc0a3db58831039274930b468caa713f1c0fb4fe074754908f` |
| Archive-published ZIP inventory | one member, `a.exe`, 18,418,688 bytes |

Metadata fetched directly without binary GET:
[SHA-256 sidecar](https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/a.zip.sha256),
[member listing](https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/a.zip.files.txt).
Digest is a recovery pin supplied by the mirror; no independently computed
package digest or inner executable hash is claimed yet. The catalogue's
September 1998 date must not be presented as a verified build date.

## Acquisition handoff (not yet run)

1. Obtain the coordinator's exclusive acquisition grant and independently
   confirm the preceding remote owner has released the host. Use a fresh
   remote task directory, with at least 512 MiB free; preserve local host
   headroom above 2 GiB. No full fixture copy, local build, or local binary
   download. Allow 120 seconds and 20 MiB for this one package, with no retry
   loop or fallback to another distribution:

   ```sh
   demo_url='https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/a.zip'
   curl --fail --location --connect-timeout 15 --max-time 120 \
     --max-filesize 20971520 --proto '=https' --proto-redir '=https' \
     --output a.zip.part "$demo_url"
   test "$(wc -c < a.zip.part)" -eq 18373265
   echo 'dd1faca49d6e5adc0a3db58831039274930b468caa713f1c0fb4fe074754908f  a.zip.part' | sha256sum -c -
   ```

   Run each command only if the previous command succeeded. On any mismatch,
   retain the failure receipt and stop; do not execute or repin changed bytes.
2. List and CRC-test the ZIP without executing it. Require exactly the one
   relative regular member `a.exe`, 18,418,688 bytes, no symlink/path traversal,
   and extract into an empty owned directory. Compute its SHA-256. Inspect PE
   headers/version resources and identify the self-extractor format. Use
   existing supported archive extraction only, bounded to 60 seconds, 5,000
   files and 256 MiB expanded content; inventory before extracting. If the
   format is unsupported, report it rather than launching the installer under
   this acquisition-only grant. No imports, filename or game route is guessed.
3. Preserve original readme/licence/setup metadata, all file hashes and the
   normal launch instructions. Confirm this is the unmodified original demo,
   not a retail repack or prototype. Record installer requirements and the
   actual game EXE/data working directory. Stop at any licence choice; neither
   extracting files nor an acquisition grant authorizes answering or bypassing
   a licence. Send the small identity/readme/inventory report for review and
   request a separate bounded execution allocation through the coordinator.

## Actual gameplay target

After package identity and launch route review, start the original program
with its supplied data through the ordinary documented installer/launcher
route. A separate runtime grant should bound first startup to 120 seconds
guest wall time / 150 seconds controller time, preserving the first real
failure or visible screen. Do not invent a launcher filename, command-line
mission selector, memory patch, or menu coordinates before observing them.

The intended proof is a playable demo mission: enter through its visible menu,
use the original readme's controls to move the player soldier, release the
input, then demonstrate a second visible action (for example aiming/firing if
documented). Capture before/after positions and ordinary input delivery plus a
reviewed full gameplay image. A setup dialog, licence, title/menu, intro,
static terrain, or autoplay is not completion. No FPS/audio claim without
separate measurement and inspection.

Save original package and extracted assets remotely with the reproducible URL,
size and hashes; Git preserves this recipe, not ignored binaries. Preserve
small evidence under a unique `scratch/runs/<UTC>-army-men-demo-.../` folder,
recording actual source/module/fixture hashes, command, terminal state,
cleanup and screenshot identity. Until a candidate corpus entry exists, keep
the report in investigation notes rather than attaching it to another game.
Publish dashboard `result.json` last only after registration and evidence
review. Public registration/distribution/deployment requires separate review.

Validation for this source-only change: bounded registry/history/ownership
searches, live metadata/HEAD observations, and `git diff --check`. No runtime
tests are represented by these source checks.
