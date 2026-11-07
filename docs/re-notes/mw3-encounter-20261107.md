# MW3 encounter attempt — 2026-11-07

The single authorized run stopped at a **passive-capture ACK timeout** on the
operation map. No cockpit, target, weapon consequence or native mission
progress was established. The worker requested a 30,000 ms passive wait through
a client with a 20,000 ms ACK deadline. This was a run-driver mistake, not a
demonstrated emulator mismatch. The first UNKNOWN closed input permanently;
the later successful ACK was preserved without reopening admission or replay.

Evidence: `scratch/runs/20261107-mw3-encounter/`. Preparation Git SHA:
`b3b0be7238796c856ce21464fed12a557bfe72cc`. All production/runtime pins match
the successful upload-gameplay predecessor. The actual browser-recovered
module is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
No production source or emulator behavior was changed.

## Preparation and retained controls

The predecessor was terminal/released before ownership and allocation. Its
published note and cockpit/after-left/after-fire captures were reviewed:
movement and heading/heat changes are supported, but no beam, hit or damage.
Passed native-input, independent-UP, identity/freshness, sticky-UNKNOWN,
GetDeviceData observer and per-file upload/drain controls were hash-referenced
and reused. The observer and its complete binary proof are byte-identical;
normal caller remains `0x4f76c8`, function 5962, entry 888199, keyboard
completion 888442. This run never armed it or sent cockpit input.

The retained demo README text documents `E` for next enemy, `1` for zero
throttle, `5` for 50%, Enter for cycle weapons and Space for fire. Its existing
path/size/hash are in `documented-controls.json`. The sole input-helper change
generalizes the existing Digit5 encoding to ordinary digits. Focused checks
passed 0/1/5 encoding, unchanged E/Enter/Space and four rejected invalid keys.
Those additional gameplay controls were not exercised on the original.

Static executable Node closure passed **66 files / 311 pins**, with no
production drift. The omitted predecessor qualification helper is not part of
the executable closure. Local staging-verifier compilation passed. Actual
staging uploaded **313/313** paths, drained every submitted upload, and verified
all remote sizes/SHA-256 before boot. All 311 runtime pins remained unchanged
at terminal custody. The previously passed locked build was reused; this
documentation-only commit does not claim a fresh emulator build.

## Reviewed original route and terminal fault

The original production browser/guest/render Worker route reached the menu,
pilot `a`, unchanged Bushwacker / Operation 1A / Battle Progression / Wave 1
setup with Firefly and Owens enemies, and operation map. Native pointer lock,
bounded mouse motion, pilot typing and clicks used the retained balanced-input
path. Every input had independently scheduled UP before DOWN and native ACKs.
No binding, profile, clock, private handler or guest-memory change was made.

All retrieved PNGs were inspected before subsequent input. The initial
`menu.png` was still the splash; a passive capture reached the actual menu.
The software cursor reached the established lower-right Launch control at
guest (575,432), distinct from physical (554,584). Its click was acknowledged,
but `mission.png`, `cockpit.png` and the late `settled-cockpit.png` all show the
operation map. **Filenames are not checkpoint proof.** No Launch tooltip,
successful transition, loading failure or emulator defect is asserted.

At **21:47:29.298Z**, command 13, `settle-cockpit`, requested only capture with
`waitMs:30000`. The client's fixed 20-second ACK wait expired and wrote sticky
`transport-closed.json` at **21:47:49.399Z**. The capture started at
**21:47:59.740Z** and finished at **21:48:00.271Z**, after which the runtime
wrote its successful `reply-13.json`. The image hashes exactly match the
earlier operation-map capture. No command or native input followed command 13.
Read-only recovery retained both the UNKNOWN and late success. Increasing the
browser's immutable runtime cap would not correct this client contract.

## Recovery and shutdown

The sole UUID-idempotent box was **bx_97gtf2ua**, created **21:44:03.604Z**,
initial expiry **22:44:03.620Z**. More than 5 GB was free before allocation;
an independent 1,500-second watchdog and a separate normal-stop OS delegate
were armed and alive beforehand. Immutable watchdog deadline:
**22:09:03.787Z**. No other box was created, resumed or changed.

After the sticky UNKNOWN, an external cleanup helper read native-event
evidence and issued CDP `Browser.close`, without game input or a new command.
Chromium exited code 0, signal null at **21:48:55.400Z**. The idle supervisor
was then terminated with SIGTERM and its profile removed. This was external
cleanup, not an ordinary game quit. Terminal custody verifies both PIDs absent,
ports 43167/46355 closed, profile/writer lock absent, 54 native events with no
held key/button, and unchanged runtime pins.

**188 remote artifact paths / 9,320,580 bytes** were retrieved and size/hash
verified before requesting box stop; repeated capture content is not counted
as distinct visual evidence. The executing module, logs and late receipt are
retained. Normal delegated stop `stop_4cf677ebf8b31b36` completed
**21:49:24.545Z**, `forced:false`. Final state **archived**, `archiveAfter:null`;
retained-data expiry is unknown. The watchdog was alive immediately before
and after normal stop. Both lifecycle delegates exited normally and the local
messageboard watcher was closed. No live resource ownership remains.

Git SHA, relevant tracked/new-source binary patches, owned helper/document
patches, module and existing media path/hash references provide recovery.
There are no source archives, copied media bundles or public deployment.

Next work should first reject or budget waits that cannot fit the caller's ACK
deadline, with focused pre-dispatch/late-ACK controls. A subsequent original
attempt needs separate authorization. This task's single run is finished;
the operation-map transition and encounter remain unverified.
