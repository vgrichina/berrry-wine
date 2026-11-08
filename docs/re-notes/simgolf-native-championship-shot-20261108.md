# SimGolf: retained Dolphin Coast loaded; controlled championship stroke

Run `scratch/runs/20261108-simgolf-native-championship-shot/` (R) fixes the
run-only manifest composition and loads the retained **Dolphin Coast MC**
through the original championship UI. Native Straight Shot selection and
an aimed target click produce **Sid Golf's first stroke** on hole 1. This
is player-controlled championship play, beyond the previously accepted
visitor scores. Gary's career or a Gary-controlled shot is not restored:
the native pro picker offers only the unchanged shipped Joe Pro and Sid Golf.

## Composition and original identities

Read `CLAUDE.md`, `simgolf-native-shot-20261108.md`,
`simgolf-release-repair-gameplay-20261107.md` and `simgolf-demo.md` first.
The predecessor's handler matched `/binaries/...` while the current browser
requested `/test/binaries/...`. R's `mount-controls.cjs` extracts and executes
the actual production manifest-resolution block from `lib/browser-shell.js`,
using the real app registry, merge implementation and local HTTP server.
`composition-qualification.json` proves the actual requested URL, unchanged
original manifest prefix, both native paths and exact response bytes. The
old wrong-URL handler fails this same test because the native mapping is
absent. This gate runs before allocation; it is not a test against a chosen
URL that the launcher never requests. No production manifest is edited.

The only additional mappings are:

- The original generated championship CSE at
  `c:\themes\championship\dolphin coast mc.cse`, from
  `scratch/runs/20261107-simgolf-release-repair-gameplay/native/after-native-export-save-5.bin`:
  **86,831 bytes**, SHA-256
  `beac714ef16e3574a517c272e5d99b495b1b9eec0f4a4b4e726f121b1eb74cca`.
- The unchanged shipped `installed/Saved_Games/AS1.sve` marker at
  `c:\saved games\AS1.sve`: **zero bytes**, SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

The original manifest remains SHA-256
`59821251459667d7c104a3bc71d4231c51cd304a7e7227509410db62f1f697eb`.
Its 1,762 original entries are unchanged; the composed manifest is
`44098f45cc99ae42e119708ee16a3a02c13521065e519ce096e391c447304be1`.
`inspect-composition-byte-streams-remote-result.json` records the original
browser's real `/test/binaries/...` response and its subsequent exact CSE GET.
`hash-actual-native-mount-remote-result.json` independently hashes the native
VFS provider's already cached CSE body at the intended path, without invoking
a file getter or materializing a provider. It matches all 86,831 bytes.
The native marker mapping has size zero and fetch count zero; an empty file
need not generate a network request. Its local HTTP bytes are tested above.
This is a championship export and original menu marker, not a career SVE.

## Personally reviewed native sequence

`review/menu-back.png` shows **Championship Courses**, recognizing Dolphin
Coast MC designed by Gary Golf: **one hole, par 3, 127 yards**. The preceding
native difficulty dialog belongs to the championship route; an initial
interpretation that it might mean standard-game selection was corrected by
this picker. The ordinary course selection reaches `review/pro-picker.png`.
Sid Golf.pro is selected without changing the golfer or course data.
`review/course-ready.png` shows the loaded coastal course and championship
leaderboard, rather than a freshly generated course relabeled as a reload.

The shipped terrain help is `Interface/parkland.txt`; shipped native control
strings identify Practice Round and the five shot types. Opening People,
an employee category and the Hire an Employee dialog did not start practice.
These inspected detours remain in the command/review evidence; no employee
was selected. The shirt/Golf Pro category eventually exposes the five shot
buttons. `review/straight-shot-selected.png` shows the actual **Straight shot**
tooltip, its green selected button, Sid at the tee and the flagged green.
Information/Reports is not used as proof of practice.

`review/aimed-green.png` and `review/first-shot-consequence.png` preserve the
native aim line and **6 Iron / 127 yards** preview. The first target click
leaves the preview active. A separately reviewed, intentional confirmation
click at the same green clears it and exposes the native **Professional
Tournament** scorecard: **Sid Golf 1**, **A.A. Slicer 0**, hole 1, par 3.
`review/straight-shot-confirmed.png` and `review/shot-resolution.png` are the
full-page evidence; `review/shot-card-detail-derived.png` is only an enlarged
crop for reading. This is a new controlled stroke, not an UNKNOWN replay or
an inference from visitor score history.

Subsequent ordinary game resolution moves Sid toward the green.
`review/final-native-state.png` explicitly reports his **22-yard Lob Wedge
to within six feet of hole 1**, witnessed by A.A. Slicer, with a Recovery
Skill improvement. Its enlarged message crop is derived evidence. This is
later game-resolved play; no separate manual wedge input, continuous ball
flight capture, completed hole or tournament win is claimed.

## Runtime and custody

R reuses the qualified bound-input chain, independent-UP pulse and numbered
exact-ACK transport. Capture review precedes dependent input and binds the
process, executing module, guest Worker, renderer endpoint and canvas.
Waits are at most eight seconds in this original run and the run-only request
client rejects waits above ten seconds and insufficient immutable deadline
budget before publication. Both negative cases are tested with zero command
publication. All **24 commands have exact ACKs**, with **14 independent-UP
pulses** and **41 trusted events**, no held inputs, UNKNOWN input or replay.

All **1,763 original files / 65,166,518 bytes**, **2,227 staged pins** and
**1,115 complete served-original reads** pass hash verification. Executing
guest and render Worker modules are recovered and match
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The pinning checkout is `905dab22b94e359df0fbe13614a13efe83e7d114`;
R retains its relevant binary diff and ignored/new-helper patches. The only
runtime pin difference from the preceding qualified run is unrelated app-size
metadata. There is no demonstrated emulator defect, production code change
or new locked-build claim.

Chrome 151.0.7922.108 uses default guest Workers and native 800×600 drawing.
Presentation is CanvasRenderingContext2D/GDI; passive evidence also records
an 800×600 bitmap-target WebGL 1 context, hwnd zero, surface `0x410008`, using
ANGLE Intel/Mesa UHD Graphics 620. This does not establish whole-scene GL
coverage, parity, FPS or audio quality.

One fresh UUID box, `bx_f8dv4kyk`, was created at 01:02:51.791Z with original
expiry 01:37:51.630Z. A detached observable 25-minute watchdog and a normal
completion delegate were armed before creation. The original browser exits
normally at 01:11:39.471Z, code zero. An immediate cleanup assertion raced
the controller's exit; a separate read-only inspection then confirms all
14 owned PIDs absent, both ports closed, profile/writer removed and no held
inputs. No input was resent because of this housekeeping failure.

All **259 terminal artifacts / 12,355,334 bytes** are retrieved and locally
SHA-verified before delegated normal shutdown. Stop
`stop_c17ed5fc24aa6a8e` completes at **01:13:08.920Z**, `forced=false`;
the final box state is **archived**, expiry null. Both lifecycle delegates
exit zero and the detached supervisor has no remaining children. Details are
in R's final `result.json`, `terminal-retrieval-verification.json` and
`normal-stop-confirmed.json`. Git and relevant patches are the source archive;
media and the retained input CSE are referenced by existing path and hash.
No source/media archive, resume, delete or public deployment is used.

Next: a separately assigned ordinary native route is needed for Gary-specific
play or career persistence. The retained championship load and Sid-controlled
stroke are established; no career restoration or full-playability claim is made.
