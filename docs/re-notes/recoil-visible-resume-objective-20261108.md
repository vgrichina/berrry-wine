# Recoil reviewed visible Resume, 2026-11-08

Run: `scratch/runs/20261108-recoil-visible-resume-objective/`.

**New visible result:** the personally reviewed, guest-drawn cursor was placed
inside the actual highlighted Resume button before the sole Resume command.
Native MENU visibly closed. Two independent passive captures then show the
living HUD, health **100**, and timer **00:00:04 → 00:00:05**. Ordinary M and
reviewed ramp/control movement remain unobserved: the unchanged 4,500 ms gate
sent **zero M/C/arrow DOWNs**, because its next HUD probe finished after the
deadline. No Resume retry, gameplay input, attack or second original followed.

The handoff at `b5d322cf4` was read and hash-matched. Before allocation, all
**806 providers** in the composed manifest passed exact size/SHA-256 checks:
the prior 790-file position closure plus sixteen owned run helpers. The actual
hermetic preloader, explicit manifest, real HUD decoder, visible-pointer helper
and accepted explicit 500 ms Escape helper loaded with an intentionally wrong
ambient PIN_FILE overridden. All eight inherited control records and four
position qualification/preflight records were hash-checked and reused, with no
standalone control reruns. Remote launch checked all 806 pins again after 807
individual uploads, including the manifest.

Selected game source is `49874a81c5ae180c20a15c6bb169d9041f028cae`;
preparation checkout is `1e096bb120ad2cc0f3500cb77faf72657bef5b2a`.
Actual guest and owning renderer module SHA-256 are both
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The prior four position helpers were copied into this owned run; the new
manifest explicitly pins the owned browser and dependencies. Peer WIP was
excluded. `source-identity.json`, `relevant-source.patch`,
`new-lib_wininit-boot.js.patch`, `owned-inputs.patch` and `media-recovery.json`
record exact Git identity, relevant binary diff, small owned helper patches,
and existing media paths/hashes. No source archive, repeated media copy or
production edit was made.

Native Software/OK, Game > Start, NEW GAME and START were personally reviewed.
The name remains `user`, difficulty Medium. Loading shows Island Storm and
briefing 1.1 Operation Short Circuit; passive observation shows 1.4 Go to Landing
Site without briefing input. Opening camera, tank transport, disembark view,
living HUD and native MENU are separate observed phases. The first living HUD
capture shows timer **00:00:02**, health 100 and the tank facing the landing ramp.
No interval is described as an exact simulation pause or exact active duration.
The original read-only ready poll expired before startup finished; its failure
and later ready/startup evidence are retained. No launcher or input was replayed.

The inherited Escape request explicitly holds **500 ms**, independently
releases, and produces visible native MENU. In that screenshot the actual
cursor is below Resume. One ordinary relative pointer move `[80,-160]` while
MENU is displayed produces `review/resume-check-one.png`. I personally reviewed
the actual arrow tip **[459,249]** inside the actual highlighted Resume interior
**[380,247,504,279]**. Host virtual coordinates were not placement evidence.

Before Resume effects, `resume-witness.json` records and validates PNG CRC,
**1024×768**, review reference `resume-check-one`, that hotspot/rectangle, and
exact screenshot SHA-256:
`9df9d8c3fcad922b98e5b993f7d2428c73483537e4a0434466f794c67da1b9ee`.
`reviewed-resume-command.json` carries that witness through the owned browser's
pointer admission guard. No unreviewed cursor inference was substituted.

The sole `ordinary-map` command preserves m500 and gateMs4500. Compound start is
**11:04:55.957Z**, gate deadline **11:05:00.457Z**. It performs one Resume
mouse DOWN/UP. The five probes comprise the MENU baseline, three further MENU
images and one fresh HUD candidate whose image starts **11:05:00.742Z** and
inspection finishes **11:05:00.932Z**, after the immutable gate deadline.
No temporal HUD pair qualifies inside the gate. The prearmed close releases
input and sends Escape at the original deadline. No gate extension occurs.
The exact source of the long final probe is not established; there is no claim
that changing serialization would suffice, and no speculative timing repair.

The unchanged `bound-input.cjs` and `compound-v4.cjs` execute two complete
uncached guest/render module byte checks per HUD probe, exact instance/epoch
joins, final co-located page-owner references and pixels, 250 ms freshness and
the timer-mask temporal pair. The late candidate remains inadmissible despite
its fresh pixels. There are **21 commands, 21 exact ACKs, zero command UNKNOWNs**,
no M/C/arrow DOWNs and no attack. The generic cleanup template's literal pending
UNKNOWN text is not a command outcome; numbered receipts establish the outcomes.

The passive observer independently captured native Resume's visible consequence
before the closing Escape:

- `observed/observed-1794135898132.png`, 640×480, health100, timer00:00:04,
  SHA-256 `5c1c4fc72d5d65a0e6333d8d5deaa53485f1ef13bec93c0c3176c9bdba07f2b5`.
- `observed/observed-1794135899064.png`, 640×480, health100, timer00:00:05,
  SHA-256 `900897c0b097af319a2a41faf46dee37f1e884a173e309734ee7269b8277f92f`.

Both images were personally reviewed and CRC-decoded. Both show the living tank
HUD facing the landing ramp; sampled M/C/arrows are released. This establishes
visible native Resume and advancing displayed timer, not ordinary M consumption,
player-controlled ramp movement, simulation FPS, or exact active intervals.

Two newly exposed generic helper defects were repaired and focused-tested in
the owned run; neither repair was replayed against the original:

1. **Unreaped owned child retained the remote lock.** The startup/runtime wrapper
   correctly held its own remote lock, but omitted waitpid on its exited Node
   child. After clean browser shutdown the wrapper remained with one zombie.
   That failure is preserved. With game cleanup complete and only the wrapper
   plus its zombie remaining, SIGINT made the wrapper execute its finally block,
   release the remote lock and exit. An independent check then verified all
   **30 recorded owned process identities** absent before stop.
   `reap-owned.py` and `locked-launch-fixed.py` add nonblocking waitpid(WNOHANG)
   before census/drain. `test-reap.py` reproduces the real zombie, reaps it with
   exit status preserved, leaves a live child untouched and propagates unexpected
   errors. `test-custody-integration.py` exercises the actual fixed wrapper with
   a child outliving its launch function, verifies recorded reaping, drain and
   lock release. Initial test-fixture failures are retained. These tests launch
   no game or browser and do not need the local heavy-runtime lock.
2. **Mutable local log aliases invalidated retrieved artifact references.**
   Collection initially hash-matched three zero-byte remote stdout files to
   `collect.log`. Its independent pre-stop reread passed, then that log grew to
   71 bytes when collection printed its result. Final verification caught the
   mismatch. `artifact-alias-failure-and-repair.json` and the failed verifier
   output preserve it. The exact zero-length bytes, whose size and empty SHA-256
   are unambiguous, are retained in owned content storage; no remote replay is
   needed. `artifact-custody.py` and the corrected `collect.py` retain known owned
   bytes by hash independently of mutable aliases. Focused tests reproduce source
   mutation, exact deduplication, wrong-byte rejection and corrupt-existing-object
   rejection. This is a tested collector candidate, not production integration.

Before quit, continuous descendant census plus the current parent closure,
exact owned paths, explicit helper roots and Chrome's referenced crashpad PIDs
recorded the complete observed owned process set. After browser cleanup and the
wrapper correction, an independent per-PID/start-time check verified all 30
identities absent, including custody, launch, observers and browser descendants.
HTTP/CDP ports were closed, profile and writer absent, numbered commands drained,
and last observed inputs released. Earlier readiness, unreaped-child, test and
artifact-alias failures remain in the run. This closes the prior task's missing
startup-lock and individual-descendant-check limitations without relabeling the
wrapper recovery as a clean spontaneous exit.

All **295 remote references / 31,487,238 bytes / 244 unique hashes** were matched
or retrieved and independently reread before delegated normal stop. Final
verification additionally checks the corrected stable artifact references and
all **49 remote PNG references** with CRC decoding. The post-stop mutable-alias
failure and exact empty-object repair are explicitly retained above.

The sole UUID-idempotent box is **bx_afvq3a5t**, created 10:56:31Z, initial expiry
11:22:31.314Z. Observable independent normal/watchdog processes were armed before
allocation; immutable watchdog deadline is **11:21:31.128Z**. Startup and runtime
held the own remote lock. No local `/tmp/wine-runtime.lock` was held for remote
provisioning, supervision, retrieval or thinking; no local heavy runtime ran.
After verified retrieval and owned process drainage, delegated normal stop
archives the box at **11:07:14.246Z**, final expiry **null**. Receipt
**stop_e067c3dd2575e338** completes **11:07:14.264Z**, forced false, error null.
Both lifecycle children exit 0; the supervisor records no remaining children.
The final API inspection independently confirms archival. No box resume/delete,
public deployment or subworker was used. Launch disk exceeded 5 GB.

`verification.json`, the numbered receipts, exact Resume witness, passive images,
focused test results and retrieval/custody/stop records contain the evidence.
Only this note is published; original and corrected helper candidates remain in
the owned ignored run. No production code/build claim is made. Next work needs
bounded passive timing evidence for the native probe that crossed the gate,
while preserving every exact check and the unchanged deadline, before another
separately authorized original M attempt. Reviewed movement requires qualified
ordinary M and its visible consequence first. Full27, parity, audio and FPS stay
open.
