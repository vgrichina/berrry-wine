# Recoil power-control objective: interrupted run recovery, 2026-11-08

Run: `scratch/runs/20261108-recoil-power-control-objective/`.

**The force-field objective remains unproved.** Recovery confirmed the entire
original command ledger and unchanged live identity. A new passive capture
shows a burning wreck under the native **LOAD GAME / NEW GAME / QUIT** menu.
Continuing this mission from that view would require loading or restarting,
outside this recovery's authorization. No recovery gameplay input was sent.
The only new commands were passive capture 25 and orderly browser quit 26.
No earlier command, including successful capture 24, was repeated.

The original worker's launcher handle 45742 ended with terminal status 143;
its worker/Codex processes were absent and no outer final/result was present.
The interruption cause is unknown. This note and the final result are recovery
reports, not a clean uninterrupted first-attempt report. The owner reported
that root sent no game input during the interruption.

The native Mission 1 brief, personally reviewed again in
`original/mission-brief.png`, says the beach force field blocks the hilltop
enemy base: find and destroy its power control. The original worker opened
the ordinary R transmission, O objectives and M map before steering.
`original/objective.png` and `original/map.png` show **objectives 0/4**,
enemies killed 0/102 and score 0. The original controls then turn around the
wreck, advance, turn inland and approach the cliff. The labels “approach-road”
and “road-heading” are command labels, not proof of reaching a road or new area.
`original/road-heading-settled.png` still faces the cliff, with score 0 and
health 47. No power-control installation was identified or attacked, and no
counter change, field deactivation or newly accessible area was established.
The previously accepted biped kill/1550 score belongs to the earlier run.

At takeover, `recovery-audit.json` records 25 contiguous commands 0–24 with
exact successful ACK IDs, no refusal, no missing reply, no writer lock and no
browser failure or sticky transport closure. The browser and passive monitor
were still live. Its last two monitor samples show all arrow keys UP, buttons
zero, and the same page Canvas2D renderer object. The existing detached
normal/watchdog delegates and supervisor were alive with the original deadlines;
none was replaced or extended.

New capture `original/recovery-passive-25.png` was personally reviewed.
Its capture chain independently recovers the live module and confirms all
16 identity fields against command 24: document epoch
`b9e34a51-72ba-4a98-b990-9064e5527f8d`, process 1000/endpoint 1/slot 0,
the same process/link/Worker/module object tokens, Worker target
`2D7E820836E0D9253E530DEC4F6250E6`, and instance
`4ec270b7-e9e0-4e47-b0b7-7e0645207bf0:1`.
There is no owning D3D render-worker endpoint. The passive monitor's renderer
object is `epoch:5`. Guest slice sequence advances 30510→43082, which confirms
execution activity, not simulation steps or FPS. The native menu and wreck are
consistent with player destruction while unattended; the exact transition and
cause were not captured. No emulator defect or objective consequence is inferred.

Earlier failures remain intact and are distinguished from input uncertainty:

- `launch-remote-result.json`: a prelaunch pin guard found missing
  `zbd/soundsM.zbd`, before any browser was spawned. The provision ledger then
  records that exact file; the guarded launch at 02:20:35Z verifies all 726
  pins and records **one original browser launch**.
- `fetch-original-startup-remote-result.json`: the premature read of
  `original/startup.png` failed because that file did not yet exist. The later
  ready file and captures confirm startup completed. This was an artifact
  retrieval error, not guest failure, input UNKNOWN or command replay.
- `recovery-terminal-remote-result.json`: the first terminal inventory's
  seven-second process-absence guard failed during shutdown. The separate
  read-only `recovery-cleanup-diagnose.json` subsequently finds every recorded
  PID absent and both ports refused. `recovery-guarded-inventory.py` checks
  ready/cleanup/file guards, exact ACKs, pins and process absence before
  producing the successful terminal inventory. The failed record is retained.

The legacy `cleanup.json` includes the generic text “UNKNOWN; never replay”
in its `pending` field. The authoritative numbered ledger has all **27 exact
successful ACKs**, including recovery capture and quit, with no outstanding
command. That boilerplate is not evidence of an unacknowledged game action.
The original `fixture-identity.json` reports zero registered matches and is
not used as fixture proof: `tested-source-identity.json` and the supplied
108 fixture pins provide the independently checked identity instead.

Tested source: main `599c695c374e796b8b07df168be6a10d7db125b5`, retained
`relevant-source.patch` and `new-lib_wininit-boot.js.patch`. All **726** runtime
pins match locally and after the remote run; all **108** supplied fixture pins
(107 original files plus manifest) match. Original executable SHA-256:
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.
The actual CDP-recovered Worker module matches the staged build:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
Git plus patches is the source archive. No source tree, repeated game media or
test binaries were archived into the run. Recovery inputs and this note are
also retained as patches.

Validation: `verify-recovery.cjs` passes the complete ledger, live identity,
module, fixture/runtime hashes, all **101** remote PNG CRC/IDAT decodes and
capture hashes, and cleanup/lifecycle receipts. The original local HTTP staging
check passes for 113 URLs, and original native key/type/combo preflights pass.
Recovery changes only this documentation and ignored evidence/helpers; no
emulator repair or new locked-build claim is made. The environment is headless
Chrome 151.0.7922.108 / V8 15.1.206.16, 1024×768, cross-origin isolated,
Threads enabled, unchanged registered Software route. Software Canvas2D is
not GL proof; audio, FPS and full playability remain unverified.
Owned evidence references and note whitespace checks pass. The global evidence
checker retains seven unrelated containment errors in other runs.

All **393 remote artifacts / 34,643,824 bytes** were retrieved and independently
SHA-256 verified **before** requesting the existing normal-stop delegate.
Unique captures, held frames, logs and actual module bytes are retained.
The browser exited 0, all 15 recorded PIDs disappeared, HTTP/CDP ports refused
connections, profile/writer lock were absent, and keys/buttons were released.
Both original lifecycle children exited 0 and the supervisor ended empty.
Box **`bx_n8ujzs67`** is **archived**, stopped at **02:29:25.020Z**,
expiry/archive-after **null** (original expiry **02:45:56.336Z**).
Stop **`stop_a16986fbed7f1006`** completed at **02:29:25.039Z**,
**forced=false**; `final-stop-receipt.json` retains the final GET.
The original browser deadline was 02:41:56.164Z and watchdog deadline
02:44:56.502Z. Recovery sampled local free disk above 5 GB; no RAM gate,
new box, resume, deadline extension, delete, public deployment or nested worker
was used.

Next work requires a separately authorized mission attempt or supported native
checkpoint. It should navigate toward the reviewed power-control objective
with frequent personal review and bounded controls. This interrupted run cannot
establish the force-field consequence, and remains stopped.
