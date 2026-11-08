# SimGolf: native visitor scores beyond an opened hole

Run `scratch/runs/20261108-simgolf-native-shot/` (R) demonstrates a native
score consequence on the unchanged demo: **Ocean's Edge MC, hole 1,
90 yards, par 3**, records **two two-stroke scores** and a **2.00 stroke
average**. Personally inspected `review/native-score-history.png` is the
primary evidence; `review/score-history-detail-derived.png` is an enlarged
crop for reading, not an independent capture. The earlier
`review/gary-round.png` has no recorded scores. This is visitor scoring,
not a verified Gary-controlled shot, practice finish or tournament.

## Retained export boundary

The predecessor's original generated CSE remains unchanged at
`scratch/runs/20261107-simgolf-release-repair-gameplay/native/after-native-export-save-5.bin`:
86,831 bytes, SHA-256
`beac714ef16e3574a517c272e5d99b495b1b9eec0f4a4b4e726f121b1eb74cca`.
It is a championship export, not a career save. R verifies those bytes and
preserves their existing reference rather than copying them into another run.

The intended run-only launcher manifest retained all original entries and
added that exact CSE at `c:\themes\championship\dolphin coast mc.cse`, plus
the unchanged original empty marker at `c:\saved games\AS1.sve`. However,
**this composition did not reach the original game**. The run's HTTP override
matched `/binaries/candidates/.../.wine-assembly-browser.json`; the current
launcher actually requested `/test/binaries/candidates/.../.wine-assembly-browser.json`.
The original manifest, SHA-256
`59821251459667d7c104a3bc71d4231c51cd304a7e7227509410db62f1f697eb`,
was served. Neither the added CSE nor its marker alias was requested.

`mount-controls.json` passed against the wrong URL, so its composition gate
was insufficient. `composition-boundary.json`, the live response inspection
and recovered `postflight.json` preserve the discrepancy. This is a harness
boundary, not native course rejection or an emulator defect. No Dolphin Coast
reload or career restoration is established. No guest VFS, configuration,
memory, course bytes, score or skills were edited to repair the missed mount;
the existing browser continued through ordinary fresh-course play.

## Ordinary course play and review limits

Read `CLAUDE.md`, the release-repair note and `simgolf-demo.md` before running.
The shipped terrain help is `Interface/parkland.txt`; R also retains extracted
native control/help strings identifying People, Practice Round, Straight Shot,
the other shot types and the native open-hole instruction. No separate shipped
manual/help file was found in the installed tree.

The game generated Ocean's Edge normally. Native panning revealed the terrain
after the initial off-map view. Build Course → Tee → grass → Green → grass,
then H, opened the 90-yard par 3; balances 120,000 → 119,500 → 118,500 and
the native opening banner are retained. Visitors subsequently arrived, played,
paid fees and joined the club. The native hole card later recorded two scores
under 2 and stroke average 2.00. Its earlier empty history supplies a before
state, rather than treating another opening banner as the result.

Several attempted People controls were misidentified during review. Opening
the empty subpanel did not establish a practice round; that preliminary claim
was corrected during the run. The Information button opened Reports, as the
demo note warns. A later Enter review also described an announcement that had
already disappeared. All commands and captures remain preserved; these UI
interpretation errors are not hidden or presented as Gary's shot evidence.
Native pause/unpause was visibly confirmed. No aimed shot input, named golfer
completion, ball-flight trajectory or Gary score was established. The later
roster click did not yield a named score card; the native hole score history
is the accepted consequence.

## Runtime, verification and custody

R reuses the released independent-UP input and exact-ACK transport unchanged.
The current-runtime production fixture passed identity/staleness negatives,
fourteen trusted mouse/key release cases, reviewed click/key ACKs, and normal
closure before allocation. Every original-run UI command followed a retrieved
capture; the interpretation limits above remain explicit. All 33 original-run
commands have exact ACKs, with no UNKNOWN input or replay.

All 1,763 original files / 65,166,518 bytes match the prior census. All 2,224
staged pins and 1,117 complete served-original responses pass postflight hash
checks. Both executing guest and render Worker modules were recovered and
match `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The pinning checkout is `f6d008d96d3526f8475e1b49428c9ff3b32b38ca`, with
the recorded relevant binary diff and ignored-helper/new-dependency patches.
There was no production code change, demonstrated production mismatch or new
locked-build claim.

Chrome 151.0.7922.108 used default guest Workers and native 800×600 drawing.
Presentation is CanvasRenderingContext2D/GDI. Passive owner evidence also
records a bitmap-target WebGL 1 context, hwnd 0, surface `0x410008`, with
ANGLE Intel/Mesa UHD Graphics 620; that context and the URL are not a claim of
whole-scene GL coverage, parity, FPS or audio quality.

One fresh UUID box, `bx_hrva4gj8`, was created at 00:36:07.993Z with original
expiry 01:11:07.858Z. The original browser closed normally at 00:48:29.701Z,
exit 0. Fourteen owned PIDs are absent, both ports closed, private profile and
writer lock removed, and recorded keys/buttons released. R retains a detached
observable 25-minute normal-stop watchdog and a normal-completion delegate;
normal completion requires verified local custody first. All **367 terminal
artifacts / 13,984,913 bytes** were retrieved and locally SHA-verified before
normal shutdown. Stop `stop_1335d8495c99c4b0` completed at 00:50:21.102Z,
`forced=false`; final state is archived, expiry null. Both lifecycle delegates
exited 0 and the detached supervisor has no remaining children. The box was
not resumed or deleted. Final custody is in `retrieval-verified.json` and
`normal-stop-confirmed.json`; no source/media archives or public hosting were
created.

Next: qualify the run-only manifest against the **actual current launcher URL**
before another separately assigned original run, then load the unchanged
Dolphin Coast CSE through the native championship UI. Gary-controlled play
remains a separate unverified part of this attempt. No career reload,
full-playability or public-deployment claim is made.
