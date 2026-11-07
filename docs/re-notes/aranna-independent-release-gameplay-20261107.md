# Aranna independent release repair; allocation held at disk guard

Ordinary snowy-world movement or attack remains **unproved**. The run-specific
mouse adapter was repaired and exercised in actual Chromium. Complete final
retained-runtime qualification remains incomplete: its local control reached
guarded acquisition and observer arming, then exited normally at its fixed
shutdown time before the target action. A fresh local control was refused
before Chromium launch by the unchanged **free disk >2 GB** guard. The later
measurement was 1,926,557,696 bytes at 11:28:23Z. No original box was allocated.

Evidence is `scratch/runs/20261107-aranna-independent-release-gameplay/` (R).
R/qualification-refusal.json records the prelaunch refusal and scope. This is
a harness/environment result, not a demonstrated emulator mismatch. The old
source-flow release blocker was repaired rather than merely reported again.

The resolved adapter in R/input-adapter.cjs replaces exactly one retained
serialized button branch with R/balanced-release.cjs. It schedules mouse-up
**before invoking or awaiting mouse-down**, at min(start+60 ms, release deadline).
Down and up acknowledgements have independent bounded waits. Up is attempted
once even if down rejects, remains pending, or receipt persistence fails after
arming. Any rejected/missing ACK or persistence error produces UNKNOWN; the
existing adapter closes the queue without recovery or replay. A successful
receipt requires both exact transport promises to acknowledge. This does not
claim that a transport failure guarantees physical button balance.

R/release-controls.json passes a failing-before control and seven real Chromium
151 cases: normal, delayed down ACK, rejected down after send, pending down ACK,
earlier deadline release, rejected up after send, and pending up ACK. The old
resolved branch produced no release at 130 ms with down pending; it released
only after down resolved. The repaired branch produced exactly one trusted
DOM down (buttons=1) and up (buttons=0) in each injected case. The delayed ACK
case completed up before down ACK; the deadline case released at 20 ms. The
rejected/pending cases remained UNKNOWN. These failures were deliberately
injected around real transport sends; no natural Chromium transport stall is
claimed. R/adapter-controls.json additionally passes five resolved-adapter
integration cases with explicit transport/identity/clock doubles, including
UNKNOWN and nonrecoverability after a post-send BeforeInputRefusal. Those five
cases are not browser evidence.

The production web-input-probe, guest Worker and render Worker were then used
with a generated native control fixture, without launching the original game:

- `control-render-target/`: guarded acquisition, one-way observer arm, measured
  relative movement (1,-145), full target proof, and balanced native click all
  completed. Personally reviewed response-03.png shows “Single Player”;
  response-04.png shows “Start New Game”. The same owning Worker admitted the
  native target at (400,155), with sharedAdmissions=1 and complete begin/hit/
  target/context/end provenance. Button counts became down=2/up=2, buttons=0.
  Action 04 armed release at 11:20:16.060Z, sent down then acknowledged it at
  .074; independently sent up at .120 and acknowledged it at .122. Capture to
  action was under 5 seconds. This is a causal **fixture** action, not Aranna
  gameplay.
- The actual guest target was `11E76F0BE516AEE45EE51444E83A8D38`, session
  `6AE70F28EC9199264EEBB1A30BAE7CD9`, slot 0 / endpoint 1. Render target was
  `C0C96AEA8531086983FBDF216AB70A23`, session
  `8F9DB4F2CB2C53D5846D922EEFECC3AC`. Both instantiated the retained standard
  observer module SHA-256
  `88ff2708a2dec89af430fac2ba778f39857c2716e851299c3ecbfa62fd5e7d1f`
  (2,221,881 bytes). The fixture created an actual GL/WebGL render endpoint;
  its visible target uses GDI. This does not qualify original D3D rendering.
- `control-staged/action-06.json`: stale capture refused specifically for
  freshness >15 seconds, zero effects. Action 11 refused specifically because
  current recentring did not permit stable unlocked absolute input, zero
  effects. Ordinary Space input caused the fixture's actual transition.
  R/natural-protocol-transition.json also passes the pure contract over those
  new browser snapshots for stale actual input protocol; it is not a dispatch.
- R/replaced-owner-negative.json: preparing the actual adapter against another
  live browser with the old reviewed owner refused for exact Worker/session/
  module identity, zero effects. It was a read-only preparation check, not an
  injected dispatcher receipt. Freshness, mapping, pointer lock, identity and
  native provenance guards were not weakened.

The successful target control above used the shared checkout frontend. Eight
files had advanced beyond retained runtime commit
`d14a8e882f9cee83408ba67587591f90bd921957`. Their exact retained bytes were
verified recoverable from Git in R/retained-git-recovery.json. R/runtime-http.cjs
serves the seven changed frontend JS files directly from those verified Git
bytes in memory, without changing shared files or archiving sources. The eighth
is a non-browser callback census. `control-retained-final/` actually launched
both production Workers through this server with the same retained module,
completed guarded acquisition and observer arm, and preserved screenshots and
identities. It **did not complete** the relative-motion/target-click sequence.
The immutable local window was 11:06:44.606–11:31:44.606Z; its normal quit ran at
11:25:44, browser exited 11:25:46.633Z (code 0), driver code 0. The terminal
capture's “single generated control session required” error follows app closure
and is not an input ACK or world-action result. A separately named immutable
local window was created for a fresh control; the disk guard refused it before
its attempt marker/browser. No deadline was extended on an active browser.

Earlier setup failures are retained: the first adapter wrapper could not find
its exact source anchor and refused before launch; another full-shell test
found an observer helper resolving the predecessor's expired gate. The wrapper
was corrected to compile that helper in this run, and the subsequent target
control passed. None of these runs replayed UNKNOWN input. Expired captures
were refused; subsequent observations were newly captured and reviewed.

The original licence authorization, exact 1,921-original recovery manifest and
2,274-entry retained runtime manifest are preserved unchanged as metadata in
R/preserved-inputs.json. The proposed R/runtime-pins.json adds this run's repair
helpers and marks qualification incomplete; it has not been staged remotely.
Provisioning/retrieval/original-run helpers are preparations, not executed box
lifecycle evidence. Original media remains referenced by existing path/hash;
no source/media archive or media copy was made. The restricted base Dungeon
Siege lane was untouched. There is no FPS, audio or parity claim.

R/cleanup-local.json verifies all 72 recorded runtime PIDs absent, 12 ports
closed, six profiles absent and this run's messageboard watcher absent. All
local browsers exited normally. Box ID/state/expiry and remote archive checks
are not applicable: allocation count is zero, no archived box was resumed and
no remote shutdown was performed. There is no box custody to hand back.

Recovery uses Git plus R/owned-harness.patch (65,284 bytes; SHA-256
`aa36da9cb148f681761b3d2fdc8d588e953dd9e4802971fa2c4756b01d732a58`),
which contains only this run's new helper hunks. The initial checkout SHA and
relevant tracked diff are retained separately. All 33 run CJS files pass
`node --check`. No production source was changed; the publication is this
note, so no production build is claimed. Evidence inventory and publication
are recorded before R/result.json is written last.

Next: restore sustained free space above 2 GB, finish the exact pinned full
path qualification in actual Chromium before allocation, then use one fresh
UUID-idempotent box with an immutable browser deadline below 30 minutes and
40 minutes including retrieval/normal shutdown. Only fresh reviewed captures
within 15 seconds can authorize ordinary original-world input. The release
repair and fixture counters alone do not prove player action.
