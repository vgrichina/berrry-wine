# Stopped before staging: stale fixed-helper identities

The plan-count orchestration preflight is now expressed as a classified full-plan
gate in `plan_gate.py`, with a cheap offline fixture of the actual accepted plan.
It found the **first concrete blocker before any upload**: three current fixed
helper donors differ from their accepted staging-plan pins. No replacement pins,
donor edits or runtime attempts were made after that finding.

The accepted plan SHA256 is
`cf6b65dcc4758b80a400411867c63d26817c190b98b38be18b7b6fd628f2ebb0`.
The derived entries are 158 main + 23 PNG + 27 DATA + ctl + canonical Wasm +
five receipts + pristine registry preflight = **216 immutable**, plus **eight
fixed helpers**, giving **224 total**. The separately staged ctl-pin receipt
would be the 217th immutable entry; it is not part of the 224-entry plan.
There is no unexplained 217/224 total-count assertion in the new gate.

The declarative plan passes classification, exact manifest identities,
destinations and main Git-blob comparison. Nine negative cases reject omitted,
duplicate, misclassified, wrong-hash and wrong-destination entries, plus omitted
guest-worker, storage, ctl and PNG dependencies. The complete static runtime
closure includes explicit Worker roots, the actual argv template and settings
observer dependencies. Its nine conditional missing specifications match the
accepted raster/no-build mode exclusions. This is an offline closure review,
not proof that the command works at runtime. No source build was performed.

`offline-plan-fixture.json` deliberately has `fixtureAssertionsPass=true`,
`structuralPlanPass=true`, **`donorIdentityPass=false`, `passAll=false` and
`stagingAuthorized=false`**. Its exact mismatch records are:

| Fixed donor | Accepted bytes / SHA256 | Current bytes / SHA256 |
| --- | --- | --- |
| dependency-preflight.cjs | 2135 / e9571aac909da0ce96238e23691e3dcbc1969d2adee3ae00f5bb60fcebefe99e | 2150 / f87c267307542b25522536b3c7a2a3b89fe49e80285aa3fa47c38763d48c69a8 |
| hash_gate.py | 3767 / 31367cec41155b976f13eb6bcb74a60360c1026373ce28a3d7d066a879b8bf54 | 4174 / 37c225b875bab00f819f3d04ce995c5c4df606e41fcafbfb22e275ee79ebfa6a |
| prepare_mutable.py | 2239 / 618a7cd90c1221260f06a7ed7f5022ef215a1e520a3168ab8122140178c13ae0 | 2408 / 941b5ad2f96c06af9bfce42696c8c8a10ce3aab5f901a640036946e04284695b |

These are precisely the files referenced by the unchanged accepted donor plan
under the launcher-configuration-capture run. Fixed pins in
`accepted-fixed-pins.json` are extracted from that accepted plan, not silently
replaced by current bytes. The current helpers include ctl in dependency roots,
extra hash/ctl checks and ordinary write-probe/locking checks. Those later
contents cannot satisfy the old pins merely by correcting the count. This report
does not classify the later helper edits as bad behavior or a guest defect.

Execution: `python3 scratch/runs/20261023-shadow-man-plan-corrected-config-runtime/plan_gate.py`
exits 0 for the **diagnostic fixture**, while recording the failed donor gate.
It has no upload or guest execution code. `verify.py` checks the failure stays
explicit, nine rejections, three mismatches, zero sessions, base preservation,
accepted original hashes and allocation. `verification.json` retains its result.

## Original integrity and runtime handback

No `recover.py` invocation, original transfer, installer, media recovery, module
recovery, runtime upload, tmpfs, clone, guest action, settings write, PNG, game
launch, player input, lifecycle operation or worker launch occurred. Attempts:
**zero of three guest sessions; zero game launches**. Prepared prior session and
operation helpers are retained as unexecuted recipes only. Runtime staging,
external-watchdog acceptance and actual full-command execution remain blocked;
syntax checks are not represented as runtime acceptance.

A distinct short read-only command rehashed the already restored destination
and compared every row to the reused accepted destination receipt: **2,083 files,
186,399,681 bytes, exact equality**. `destination-original-hashes.json` is the
accepted receipt; `confirmed-original-hashes.json` is this handback observation.
No second restore took place. Registry remains 17,088 bytes,
`d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3`.
Launcher, MSS32, DSETUP and game identities remain exact in `handback.json`.
Originals remain writable because the locking phase was never reached.

Canonical `ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`
is a donor identity only: no module was loaded on this box in this task.
Runtime source remains `58e90870a40a541a4083cae5e987ca8de31889e6`, with
read-only remote main reconciled to docs successor
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. All 8,306 base index paths remain
unchanged; no shared source/census/index edit or main integration occurred.

Configuration defaults/ordinary OK, actual settings writes/persistence and Play
are **untested**. Historical Spielen-disabled and synchronous
`ABANDONED wndproc` after 64 rounds/yield15 remain historical limits, not a new
guest failure or callback-completion result. No warnings were made fatal.
No candidate result.json is fabricated; this unregistered guest uses the
investigation-note route. No new PNG exists to review.

Admission before checkout was **60,735,488 bytes** with used donors, own allowance,
tool/Git allowance and 8 MiB reserve inside 64 MiB. The final verifier measures
actual allocation and host free against the mandatory 2,982,150,144-byte floor.
Remote handback: immutable 193,617,920 bytes, fixed 4,096, empty mutable 4,096,
free 48,850,632,704 bytes. No guest allocation peak exists.

**bx_fn7pn7yg remains RUNNING**, API idle/healthy, stop null,
expiry **2026-10-23T03:46:00.580Z**. No Node processes or owned groups remain;
there was no guest process to terminate. Coordinator retains lifecycle ownership
and the 02:50 shutdown checkpoint. Handback is before 02:45 UTC. No lifecycle
change is authorized to this worker.

Evidence and the narrow re-note are published only to
`task/shadow-man-plan-corrected-config-runtime-oct23`. `publication.json` and the
append-only shared messageboard identify the pushed commit and independently
verified remote SHA. Stop at this blocker; no replacement work is assigned.
