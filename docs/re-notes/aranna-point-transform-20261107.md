# Aranna: ordinary canvas mapping repaired; installed demo reaches world

The retained browser harness now accepts ordinary windows whose renderer
viewport and transform are null. The original installed demo passes its EULA,
renders the main menu, enters Single Player, creates the named hero Aranna,
and selects Normal difficulty, then renders the snowy world with the hero,
portrait, compass, and action HUD. This is a harness repair, not an emulator
CPU or Win32 semantics change. Causal world movement remains unproved.

Evidence is `scratch/runs/20261107-aranna-point-transform/` (R), following
[the demonstrated zero-effect mapping rejection](aranna-crt-browser-20261107.md).
Git remains the source archive; no source or media archive was created.

## Mapping and guards

The resolved source chain is crt-browser → relative-move → atomic-observation
→ native-point `point-mapping.cjs`. The final implementation asserted both an
exclusive viewport and transform before mapping any point. `driver-source.cjs`
compiles its retained source under the current run's filename, so its generated
`toPage` resolves the current run's actual mapper. R/point-mapping.cjs now owns
that implementation explicitly rather than hiding the change in a wrapper.

For an ordinary canvas, it searches integer CSS points using the inverse of
the production `lib/browser-input.js` `eventPointFromClient`: subtract the
owning canvas rect offset, multiply by canvas size / displayed size, then
floor. A maximum one-pixel representability error is retained for downscaling.
It rejects invalid/out-of-bounds points and empty/nonfinite geometry. Only
explicitly null viewport **and** transform select this route. Any exclusive or
partial exclusive geometry still uses the unchanged native-point mapper and
its checks. No exclusive viewport is manufactured for ordinary windows.

The passive stable-input snapshot also recognizes an ordinary unlocked canvas
when there is no viewport, transform, active recentring, or positive automatic
relative-input intent. The old snapshot required an exclusive auto-relative
poll result even for the ordinary EULA. Owner/module/session, app owner,
protocol epoch, movement epoch, complete geometry, visibility, focus, lock,
native target/provenance, and quota checks remain. R/contract.cjs additionally
requires an input capture age of 0–15 seconds at dispatch. Real original stale
input refusals retained zero effects; fresh reviewed commands were required.

`mapping-control-result.json` records an actual Chrome 151 browser control:
800×600 canvas, displayed at 600×450, offset (73,91), null viewport/transform.
The old mapper rejects (164,428); the corrected mapper chooses page (196,412).
Trusted mousemove/mousedown/mouseup, observed through the actual production
conversion function read from its source, all report (164,428); final buttons
are zero. The capture was personally inspected. Mismatched owner, retired
session, stale protocol/movement epochs, changed geometry, and a 16-second-old
capture all reject before input. Exclusive mapping parity and missing-exclusive-
component rejection pass. This control instantiates no guest and synthesizes
no guest callback.

## One original attempt

One persisted UUID Idempotency-Key created `bx_c9bc8zsn`, initially expiring
08:03:56.730Z. There was no creation retry or stopped-box resume. Before launch,
all 2,272 baseline/runtime/run-helper pins passed remote size/SHA-256 checks.
The 55 media parts were individually checked and reconstructed to the existing
226,873,456-byte Expansion.dsres SHA-256
`3ed0688349f33b2dd7b9458c18cfbbc00490353c5888a93cd02c10da7f3c3b10`.
The unchanged demo EXE is 3,874,869 bytes, SHA-256
`fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
The supported CRT remains SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
The prior generated CRT/dbghelp passes were not repeated.

The original's instantiated module is SHA-256
`88ff2708a2dec89af430fac2ba778f39857c2716e851299c3ecbfa62fd5e7d1f`,
2,221,881 bytes, CPU worker slot 0 / endpoint 1. Captured completed render
slices identify render endpoint 1, API `legacy`, requested backend `webgl`,
WebGL 2, and ANGLE / Mesa Intel UHD Graphics 620. This is actual runtime
identity, not an inference from the UI selection. Runtime sources remain
separately identified by the inherited manifest, rather than current main.

The original ordinary EULA shows canvas offset (10,160), size 661×602, and
null viewport/transform. ACK 1 completes `move:164,428` at page (174,588).
After personally reviewing the pointer over Accept, balanced click ACK 2
accepts the EULA. Two independently reviewed Escape presses skip actual
rendered cinematics. The menu, Single Player submenu, Choose Hero, name
Aranna, and Difficulty screens were personally inspected. Single Player
click ACK 20 includes the retained full native target proof and native point
(400,155); no callback or registration table was forced. Start New Game,
Next, and Normal clicks have separate fresh reviews and completed ACKs.

Two optional menu helper wrappers (`arm-observer.cjs`, `proof-base.cjs`) were
noticed absent from the current run directory and staged before their first
use, after original launch. Their inherited source had already been staged;
the supplemental 2,274-pin manifest passes. This falls short of the requested
all-helpers-before-original ordering and is retained as a setup limitation.
The one-way passive observer was armed once; no journal or quota was reset.

Read-only provider inspection initially used Puppeteer's default connection
viewport, which resized the page to 800×600. This caused inconsistent teal
captures. The original 1001×800 viewport was explicitly restored, then a
fresh scene was reviewed before input. Subsequent read-only connections use
`defaultViewport:null`. `viewport-restored.json` retains the correction.

## Loading observation and limits

After Normal ACK 39, captures 40–42 show a black canvas. Bounded read-only
worker samples show changing execution and wait contexts, not a fixed trapped
instruction. The sampled string allocation/free routines are retained in
`load-loop-disassembly.txt` as test evidence, not a demonstrated CPU mismatch.
Capture 43 shows a rendered narrated world introduction: mossy terrain,
stonework, a green light, and subtitles about the defeat of Gom. This is a
cinematic, not causal world movement. Personally inspected captures 44–49
then show the snowy playable world outside a house, the named hero with a
green selection ring, portrait, compass, journal notice, and action HUD.
These establish world rendering, not movement. Balanced reacquisition ACK 47
completed, but pointer lock was released again; subsequent input was refused
before dispatch. Captures 46, 48, and 49 retain the zero-effect refusals.
The exact next boundary is fresh reviewed world input with stable lock/mode
ownership, followed by a visibly changed hero position or action. No emulator
semantics fault was established. The last attempted review found the already
terminated supervisor (`ESRCH`); it dispatched no guest input and was not retried.

The native point journal reached 15 manager stores without reset. The broker
resource observer reached its fixed 32,768-record limit during loading;
capture 42 reports 6,158 dropped records, and later coverage is incomplete.
No complete post-limit API/resource trace is claimed. Shared local disk fell
from over 3 GB to 779 MB while R occupied only 49 MB; the coordinator was
notified and further guest input was held pending recovery of the 2 GB floor.
The floor recovered before the last world attempts; final local space exceeds
3 GB. This interruption and the retained 15-second freshness gate consumed
the remaining opportunity for world movement before the supervisor's planned
07:57:56Z shutdown. There was one original launch, with no replay or second box.

Terminal closure verification passes all 2,274 pins. The terminal census finds
all recorded runtime processes absent, ports 36501/40485/45541 closed, the
temporary Chrome profile absent, and all four runtime/build locks available.
Unique captures, ACKs, logs and identity evidence are hash-verified locally
before the explicitly delegated normal, nonforced box shutdown. The exact
retrieval count and terminal box state are recorded in R/result.json.

Final observation, recovery, shutdown, validation, and publication are recorded
in R/result.json, written last. No CPU/Win32 implementation changed, so no
production build is claimed or required for this documentation-only commit.
