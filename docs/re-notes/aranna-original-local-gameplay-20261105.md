# Aranna original local gameplay, 2026-11-05

Task: `NEW-GAME-ARANNA-DEMO-20261010`. Evidence directory:
`scratch/runs/20261105-aranna-original-local-gameplay/`.

The serialized gate passed after rectangular1610 FINAL16:40:09, RFsource1620
FINAL16:49:43, and Lords callbacklifetime1635 FINAL16:55:00. Independent checks
found 287 recorded PIDs absent, 111 ports refused, 23 profiles absent, four
locks free, no heavy runtime, and adequate disk. Strong1555 and laptopHeroesII
were untouched. No box, SSH operation, subworker, or deployment was used.

At 16:39:19Z the original installer and every extracted member were verified
in place against the existing receipts. Installer:
`scratch/game-media/aranna-demo-20261105/dsloademo.exe`, 260378624 bytes,
SHA256 `e3923f18d3ec9bf52ffe556821dbaa2078e985087c7bf4b171a36b9883b851cf`.
The extracted directory contains the recorded 28 files, 281799760 bytes;
`DSLOA.exe` SHA256 is
`fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
Both case-distinct setup DLLs are intact and identical. No media was copied.

The original EULA was accepted through ordinary input. The game then reported
a resource-read failure before displaying a menu or gameplay. No emulator
defect was established and no production source was changed.

The route matched the historical extracted-original executable recipe:
`DSLOA.exe` plus 26 canonical companion paths, eagerly mounted at `C:\` through
the browser harness's documented `wineApps` registration seam. The identical
case-colliding setup DLL has one VFS alias. This was a launch of the recovered
extracted game; the self-extracting installer was not executed. Extraction and
mounting are not evidence of an ordinary Windows installation.

The actual shared dependency resolver found the original native Miles DLL,
SHA256 `ddb8c4180836d63c81d1657f169c461f42be10795641b0f39cae7acb799ced11`.
It reported the absent native `ole32.dll` explicitly; that system import used
the existing built-in API fallback. No private native import was missing.
The production queue validator passed, helper syntax checks passed, all ten
`test/test-richedit-stream-callback.js` checks passed, and
`flock /tmp/wine-build.lock bash tools/build.sh` passed before the guest run.

Tested source: main `9026e21fd1973cf0cdcdd9733894d5432239be78` with an empty
relevant runtime binary diff. Browser-compiled standard module: 2173299 bytes,
SHA256 `10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031`,
confirmed by passive hashing of the loaded module. The full build also produced
the compatibility module, 2175945 bytes, SHA256
`eb59d32227cc18233f93c7b757e0700f9558f0a31af7e3d38090669d4fc15158`;
the original game was tested only on the standard module. Chrome 151 on the
coordinator-local host used guest Workers and the supported SwiftShader/WebGL
presentation option, with a 1000×800 viewport.

A pre-guest browser preflight failed at 16:56:48Z because this worker supplied
`@PATH` to `--before-launch`; production directly evaluates that option as
inline JavaScript. No guest launch or input occurred. Its exact caller, logs,
exit receipts, and cleanup remain in `preflight-before-launch-format/`.
The caller was corrected to read the file into its structured argument and
validated against the actual production inline-eval contract. No production
guard was changed. There was one subsequent original guest session.

`startup.png`, personally reviewed, shows the readable original agreement and
Accept button. The live canvas was 660×602 at page (10,160). Accept was clicked
at page (173,588), normalized canvas fractions
(0.24696969696969698,0.7109634551495017). The ordinary command completed at
16:58:36.351Z. The EULA closed; the original created its Dungeon Siege window
and a second guest Worker. The final registry readout records a new
`HKCU\Software\Microsoft\Microsoft Games\Dungeon Siege Legends of Aranna Demo\Eula`
key with DWORD `FIRSTRUN=1`, absent before launch. This establishes
`acceptedInGuest=true`; no acceptance value was pre-seeded.

The first post-acceptance failure, already present in `after-accept.png`, is
the guest's **Dungeon Siege Critical Error**: “Read error! Resource file is
either corrupt or unreadable,” naming `C:\Resources\Logic.dsres` and
`last error = 0x00000017`. The black game display, critical-error taskbar title,
and diagnostic text in the runtime log were personally reviewed in both
`after-accept.png` and `first-failure.png`. No gameplay scene or ordinary
player-control response was reached. The ordinary Accept response is qualified
separately from gameplay.

The final host-side VFS inventory hashes `C:\Resources\Logic.dsres` as
4206880 bytes, SHA256
`90b26f179364a4d25f7053e8aa41932d51fcd0e563e37820894c3dbfdcf9d0e5`,
matching the canonical extracted original exactly. All 28 non-Windows file
records in that inventory match original member hashes. This is host-side
payload evidence, not an export of the Worker filesystem or a proof of correct
guest reads, decompression, archive checksums, or installed state. The current
evidence does not distinguish those causes. No speculative repair or second
original guest launch followed.

The supported queue requested quit at 16:59:14.386Z. Chrome exited normally
with code 0 and no signal; caller and server also exited. Independent cleanup
confirmed all three recorded runtime PIDs absent, both ports refused, the
profile absent, and all four locks free. The first preflight's three PIDs,
two ports, and profile had also been independently checked after its normal
Chrome exit. No test box was assigned: ID/state/expiry are N/A, and coordinator
sandbox lifecycle ownership is unchanged.

Recovery uses the original installer and extracted member paths above, plus
the existing extraction receipt for every member's size/hash. `app-config.json`
records the exact original-to-VFS mapping; `payload-state.json` records the
observed hashes and genuine registry change; `final-state.json` retains the
complete read-only host inventory. `personal-reviews.jsonl`, ordinary queue
commands, screenshots, console, and output logs retain the UI sequence. No
source archive or repeated media was created. The canonical payload remains
in place. No new corpus app was registered and no capture was attached to an
unrelated candidate.

Next: explain the first `Logic.dsres` read failure using bounded generated
file/seek/archive controls and the retained original data. A further original
session requires a changed, proved prerequisite. Installation, menu, gameplay,
audio, and FPS remain unqualified.
