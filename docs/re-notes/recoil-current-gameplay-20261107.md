# Recoil original demo: current-main browser gameplay, 2026-11-07

Reviewed original player-controlled forward movement, left turning and pulse-gun
firing passed in `scratch/runs/20261107-recoil-current-gameplay/`. No emulator
divergence was reproduced and no production source or media was changed.
Historical acceptance and limits in [recoil-demo.md](recoil-demo.md), including
main `274902b02` browser/touch gameplay, remain intact.

The tested source was main `b56e2dc34062398bc975ecddbb80c48a57b9b2a3` plus
`relevant-source.patch` and `new-lib_wininit-boot.js.patch`. The first patch is
empty; the latter preserves the pre-existing untracked runtime dependency.
`runtime-pins.json` records all 742 staged files, including the run-specific
browser/input helpers. Git is the source archive; no source/media archive was
made. All 107 original game files and the existing browser manifest match the
108 supplied pins in `20261107-recoil-next-inputs/fixture-pins.json`; none was
repinned. Original executable SHA-256:
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.

The actual guest Worker module was recovered through CDP, retained as
`original/module-e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467.wasm`,
and matches the staged build. The environment was headless Linux desktop
Chrome **151.0.7922.108**, V8 **15.1.206.16**, 1024×768, cross-origin isolated,
with Threads enabled. The direct registered route was
`/index.html?debug&threads&app=recoil_demo`; the dropdown was not used.
The game selected **Software**. The toolbar's WebGL selection does not establish
an owning accelerated renderer: this run has no D3D render-worker endpoint.
The owning software page renderer and canvas are observed separately.

The live application was process 1000, endpoint 1, slot 0; guest Worker target
`1A6985B7F3C30C9FDCDA5B13569FECA1`. Its document epoch was
`fa1c8875-83ce-48c2-8810-92849b4cdcfa`; the software renderer object token was
that epoch plus `:5`. Capture/binding JSON records actual process, endpoint,
Worker, instance and module objects before and after each screenshot and before
input. `passive-monitor-v3.jsonl` records the same software renderer object,
document and endpoint throughout the gameplay holds, with canvas hashes and
physical input states. `served.jsonl` and `http-resolver-pins.json` preserve
HTTP/hash/isolation evidence for the fixture and system DLL/TLB closure.
The four registered bundled MFC/CRT images were loaded; built-in OLE32/SHELL32
handling is explicitly reported in the original log, not described as native
DLL loading. Fonts and `stdole2.tlb` were provisioned.

Generated real-Chromium controls ran before the original. They exercised live
Worker/module/document and render-worker owner binding, zero-effect rejection
of five owner replacements, stale/slow screenshot rejection, balanced native
key holds and partial-failure release, passive guest/render progress, and
sticky unknown/late-ACK transport closure. Ordinary DOM relative-motion and
trusted CDP mouse down/up delivery also passed. Run-specific input admission
uses a **120-second** review interval, retaining the screenshot's original
capture time and requiring its current review/hash and matching live owners.
Observed admitted scene ages were 9.258–59.361 seconds, including 20.690 seconds
for forward input: a 12-second interval would have rejected valid reviewed
scenes. Fresh captures were inspected; an older review was never substituted.

Ordinary Software → OK → Game → Start reached the original menu. A click
acquired pointer lock; bounded DOM mouse movements supplied relative counts
through the production browser input bridge. Reviewed New Game and Start were
activated with paired ordinary left-button holds. Read-only original cursor
feedback at `0x564258/0x56425c` corrected one overshoot. No guest memory,
configuration, timers, callbacks or menu state were forced. Mission loading and
the opening completed naturally without skip input.

Reviewed gameplay evidence, all relative to the run:

- `original/opening-natural-2.png` → `original/after-forward.png`: ArrowUp
  for 1.8 seconds advances toward the wreck, which becomes much larger and
  immediately adjacent; the minimap position changes.
- `original/after-forward.png` → `original/after-turn-left.png`: ArrowLeft
  for 1.8 seconds rotates the tank/view and minimap; the cliff fills the view
  and the dam moves to the right edge. The in-hold frame
  `original/held-1794040618391.png` shows the wreck moving to the right.
- `original/firing-baseline.png` → `original/held-1794040697149.png` →
  `original/firing-after.png`: a fresh 1.8-second left-button burst produces
  visible cyan pulse-gun flashes/projectiles, then releases. The primary weapon
  has no demonstrated ammo decrement. Health changes during the broader run
  are not attributed to firing. The earlier burst also has reviewed frames
  `original/held-1794040634080.png`, `original/held-1794040634580.png` and
  `original/held-1794040635303.png`.

`in-hold-verification.json` records physical held-state samples and distinct
canvas hashes: forward 16 samples, guest sequence 33238→33557; turn 15 samples,
35727→36046; first fire 15 samples, 38581→38872; matched fire 15 samples,
49569→49876. Each hold has a stable renderer/document identity and advancing
guest execution with changing rendered pixels inside the held interval.
These counters do not assert guest polling frequency, simulation steps or FPS.

Validation: locked `tools/build.sh` passed; generated owner/input/transport
controls and mouse delivery controls passed; all 742 runtime pins passed again
at cleanup. An initial generated control used an older helper without the
capture-completion timestamp and failed its control assertion; it was corrected
before original launch. A launcher environment value was initially numeric;
Python rejected it before creating any browser child. Correcting that known
pre-effect error did not replay the original. There was one original browser
launch, and all 20 numbered original commands have matching successful ACKs.

All 308 remote artifacts (31,954,278 bytes) were recovered and SHA-256 verified
before the delegated normal stop. Fifteen recorded process IDs were absent,
both HTTP/CDP ports refused connections, the browser profile and writer lock
were absent, and physical arrow/button states were released. Box
`bx_b3dw6rzy` reached **archived** at 08:39:33.433Z through completed nonforced
stop `stop_212eeb29a8bdaee5`; expiry/archive-after is null after stopping.
The box's inherited descriptive name was `mcm-bound-input-20261107`; allocation
UUID and actual ID, not that label, identify this single fresh Recoil box.

No physical-phone, WebKit, audio/audibility, logical/display FPS, accelerated
rendering or native-game parity claim follows. Next work can independently
qualify those environments or measurements; this run requires no gameplay fix.
