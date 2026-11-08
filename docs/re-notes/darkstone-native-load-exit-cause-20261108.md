# Darkstone: earned native restore, new victories and traced exit, 2026-11-08

One fresh box/browser loaded the exact retained character and named-save bytes.
Personally reviewed inventory established **Gold 1532 / Victories 1+0**, then
ordinary resumed combat reached **Victories 2+0 and 3+0**, with Gold still 1532
and LIFE 28/35. Native **Save a Game → New Save** created another named slot,
whose bytes were recovered. No new character or repeated gold pickup was used.

The final removal in this run was deliberately requested through the native
menus and is causally traced to **guest ExitProcess(0)**. The earlier
[cross-session run](darkstone-cross-session-native-save-20261108.md)'s spontaneous
removal was **not reproduced**. Its exact boundary remains: render endpoint closed
at 02:22:00.859, then command 8 failed the current-owner check at 02:22:12.066,
before admission or input. That historical reason is still unknown. This run's
normal exit cannot retroactively identify it as death, save error or emulator bug.
No production/emulator repair was demonstrated or made.

Evidence is ignored `scratch/runs/20261108-darkstone-native-load-exit-cause/` (R).
The [earned-save predecessor](darkstone-deferred-closure-gameplay-20261107.md)
provides the original game-generated checkpoint.

## Exact save, controls and observer qualification

Both original files were reused unchanged through the normal composed manifest,
production `WineAssembly.loadFiles` and `VirtualFS` mappings:

| Native path | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\dsave\characters\characters.lpl` | 1,342,076 | `d1e1457fdae3ab68379e5afebd3d1e348ad0ed81b7228253411ec32dc44f86cd` |
| `c:\dsave\games\game641d_6aef1a57.sav` | 3,204,264 | `e4e0a15f206c69ac33f55afcb7bb341790c6f2578c5e6b9429d0128c08492e78` |

R/checkpoint-provenance.json names the retained source artifacts. Their source
and staged hashes were checked again after the run. The local actual-HTTP,
manifest composition/merge/normalization, loadFiles, mounted-hash and native
wildcard-enumeration controls passed before allocation. Registry and original
manifest files were not edited.

Run-local lifecycle observers were attached to the actual page, guest Workers
and render Worker before original loading. They preserve original calls and
record timestamps, arguments, exception events, caller stacks, guest slot and
endpoint identities, available EIP/ESP/yield/halt and stack words. Coverage includes
host exit/exit_thread imports, terminal guest slices, page stop/runtime retirement,
window removal/onStopped, Worker transport failure/termination, render stop/failure,
target detach/destruction/crash and browser close. The close path retains page
state, native events and console evidence even after app-owner admission fails.
These are run-local wrappers, not a new production framework.

Before allocation, R/observer-transparency.json verified original receiver,
arguments, result, exception and callback behavior. Real production Workers and
module then exercised an actual generated-fixture x86 ExitProcess(37), a distinct
UD2 trap, and renderer/guest retirement. Observed versus unobserved runs matched
EIP, ESP, yield, trap, blocks and registers; R/lifecycle-qualification.json records
the passing comparison. The generated fixture's thunk metadata was prepared for
the actual ExitProcess API ID; no original game memory was edited. Actual trusted
input/release, wrong-identity and readiness controls also passed. All five local
qualification browsers retired.

Preparation failures remain in evidence. The first observer read Worker
`location.href` too early and provoked a Chromium `url_.IsValid` fatal check;
using the URL supplied by CDP corrected that run-local observer. Two subsequent
generated-control attempts used an incorrect API-ID/thunk assumption, corrected
before the passing observed-v4/unobserved comparison. These were local controls,
before box allocation. Separately, the first remote launcher rejected the raw
manifest hash before spawning Chrome: the handler correctly serves composed
manifest bytes. Only the expected HTTP pin was corrected to those already-tested
bytes. R/prebrowser rejection evidence and http-pin-correction.json preserve this.
There was exactly one original Chrome session, with no original replay.

## Personally reviewed gameplay

Shipped `dconfig/keyboard.txt` and `readme.txt` establish **I** for inventory,
**Tab** for map, **Space** to close panels and **Escape** for the main menu.
R/binding-provenance.json pins both files. They provide no documented pause;
none was assumed or privately injected. No state, clock or private-pause edits
were made. The predecessor's map-icon interpretation was not reused.

Native **Load a Game → retained slot → OK** reached Ardyl. An acknowledged
two-second I hold initially left the world visible; its eventual consumed effect
was the inventory, not the map. R/review/belt-potion-result.png establishes
**Gold 1532, Victories 1+0, LIFE 13/35, MANA 25/25, Food 96**. Admission and input
ACKs alone were not treated as proof of guest consumption.

Two early potion-target attempts were too far right and produced a Main menu
tooltip; no consumption is claimed for those. After Space and passive settling,
the actual canvas bounds and visible red belt potion were reviewed. Corrected
right-click targeting produced the native **Healing Potion / Right click to use**
tooltip; the settled capture shows that potion gone and the life strip refilled.
The earlier inventory had declined to LIFE 11/35 while inspecting, so an open
panel clearly was not used as health protection.

Three bounded two-second native left holds targeted the reviewed standing
Skeleton. Captures show its health shortening and subsequent consequences.
R/review/new-progress-inventory-request.png establishes **Victories 2+0,
Gold 1532, LIFE 28/35, Food 92**. Following native New Save,
R/review/new-native-save-result.png shows **Victories 3+0, Gold 1532,
LIFE 28/35, Food 91**, with the warrior alone beside the tree. This establishes
new encounter progress beyond the restored one-victory checkpoint. It does not
establish an area transition or full playability.

Before quitting, read-only VFS recovery under the current page/process owner
retrieved these game-written outputs at **03:14:01.394 UTC**:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| Updated `characters.lpl` | 1,342,084 | `d54321486e009fa7fb63a9d50cd66cd10f831bbfdd285f4288c2b85628234fd7` |
| New `game641d_6aefe8e0.sav` | 3,204,264 | `09ae0ed5035dd00f36087cd1040a071d5598049facc4086e70330f5e67aea987` |

R/recovered/original/native-vfs-saves.json and the hash-named binary artifacts
retain the outputs. The original named slot remained byte-identical. The new
slot was **not reloaded**; its creation and the post-save visible three victories
are separate observations, not proof of the counter encoded in a reloaded slot.

## Causal exit and terminal guard

After recovery, native **Quit → Leave this game? → OK** returned to the main menu.
Then **Exit Game → Exit from Game? → OK** deliberately ended the process:

| UTC | Actual observation |
| --- | --- |
| 03:15:45.003 | Owning guest slot 0 / endpoint 1 calls exit with argument 0; page host exit also records 0. Guest EIP 5142297, ESP 122683240 and 16 stack words retained. |
| 03:15:45.004 | `WineAssembly.stop` is called from host exit (`host.js` h.exit); exitCode 0, followed by `_stopGuestRuntime`. |
| 03:15:45.005 | `_removeAppWindows` and `onStopped`; process exited true / exitCode 0. |
| 03:15:45.011 | Main guest terminal slice: EIP 0, trapped null; registers and prior EIPs retained. |
| 03:15:45.012–.015 | Render endpoint closes, render stop/manager stop and Worker termination follow. |
| 03:15:47.463 | Command 22's post-input capture fails `one isolated registered app required`, after native exit removed the app. |
| 03:15:47.701 | Chrome exits code 0, no signal. |

R/causal-exit-observations.json contains the full context/caller records; the
original console and target lifecycle streams were preserved. Earlier
`exit_thread(0)` events are helper-thread retirement, distinct from process exit.
No original trapped terminal slice or target/Runtime exception was recorded.
The console's startup comctl32.dll fetch error and system-data 404 remain retained;
they are not evidence of this exit's cause.

Commands 0–21 have exact successful ACKs. Command 22's native DOWN and independently
prearmed UP both have ACKs, but its final capture/command ACK does not succeed.
The first terminal guard failure closed the transport; no further input or replay
occurred. Post-guard state preserves `apps: []`. Across the original there were
52 trusted events: 14 balanced mouse pairs, five balanced key pairs and 14 moves;
no held input remained. This demonstrates why owner removal alone cannot identify
the older run's cause: here the same guard follows a separately proven normal exit.

## Provenance, verification and shutdown

R/source-recovery.json records staged Git source
`64e3af3599a2865e31bc1d0aa3d002927398ec59`, relevant tracked/untracked binary
patches and owned helper patches. Git is the source archive. All **526 runtime
pins**, including 151 lib JS files, matched after browser retirement.
The actual instantiated guest/render module SHA-256 was
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The owning `d3d-render-worker.js` endpoint used legacy/WebGL with an observed
WebGL 2 context and ANGLE/Mesa Intel identity. Chrome was 151.0.7922.108 on Linux
x86-64. R/media-refs.json references the existing 16 original media files /
33,566,415 bytes by path and hash; no source/media archive was made.

Box **bx_qn2hasj8** was allocated at **03:03:47.842 UTC**, initial expiry
**03:29:47.699 UTC**. The detached independent 25-minute watchdog was armed before
allocation with immutable deadline **03:28:47.850 UTC**; browser deadline was
03:26:47.532. All **284 remote artifact references / 21,460,680 bytes**, comprising
**236 distinct contents / 21,446,326 bytes**, were retrieved and independently
SHA-256 rechecked before the normal-stop request. R/retrieval-verified.json maps
every reference, including deduplicated local captures and the unchanged save.
R/final-audit.json passes 23 PNG CRC/scanline-decode checks, exact ACK/pulse/trust
checks, owned containment, helper syntax and checkpoint hash verification.

Both owned Node/Chrome PIDs were absent, both ports closed, profile and writer
removed. Normal stop **stop_dd75ac8555fb013b** completed at **03:18:40.466 UTC**,
`forced:false`; the box is **archived**, stopped at **03:18:40.448**, expiry null.
Both lifecycle children exited 0 and the supervisor has no remaining children.
The append-only board watcher was retired. Sampled local free disk and the
browser-enforced floor stayed above 5 GB. No RAM gate, box resume/delete,
public deployment or nested worker was used.

Only this note is committed; no production code changed, so no code build or
emulator regression repair is claimed. Note whitespace and owned evidence checks
pass. The global evidence checker retains seven unrelated containment errors.
Next useful verification is native loading of the new slot with its updated
character file. The historical spontaneous removal's cause remains open; FPS,
audio, broad GL/parity and full-playability claims remain outside this result.
