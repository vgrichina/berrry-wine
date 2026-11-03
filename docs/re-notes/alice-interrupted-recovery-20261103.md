# Alice interrupted campaign recovery, 2026-11-03

Recovered and retired the existing original campaign on `bx_9vpsvd62`; no new
boat, game launch, opening replay, build or staging was performed. This is a
recovery and evidence result, **not a successful first-error campaign**. The
recovered full archive contains an earlier `startup1` connection-refused RPC
at 13:56:42.226 UTC and `startup3` timeout at 14:01:05.066 UTC. These are the
earliest recorded blockers. The predecessor continued afterward. The recovery
worker checked the last transaction before controls but should have inspected
all earlier receipts first; its subsequent continuation also cannot qualify
under the strict first-error rule. No engine failure is established.

Evidence is in ignored `scratch/runs/20261103-alice-interrupted-recovery/`.
Predecessor local files were copied with a full manifest into `predecessor-local/`;
remote originals, captures, receipts, build evidence and runtime recovery files
are retained under `retrieved/`, without extraction over shared source or
replacement of predecessor local artifacts.

## Original identity and limits

The explicit boat query reported available `idle` state and original expiry
`2026-11-03T15:53:37.051Z`. Custody and delegated shutdown transferred to this
recovery worker. `/proc` verified original supervisor PID **7743**, game PID
**7744**, parent relationship and complete native command line. The remote
start record equals the retained original: start **13:56:42.082059 UTC**,
guest deadline **14:26:42.082059 UTC**, outer deadline **14:27:42.082059 UTC**.
The host instruction budget remained **100000**, with the original
1800/1860-second and 400-command limits unchanged.

At recovery, the command counter was **108**. The last `center_neutral1`
receipt had completed at batch **4362**, with zero pending frozen credits and
no error. A fresh snapshot confirmed the same state. Its fresh PNG matched the
retained last PNG byte for byte, SHA256
`076cb601a188baa62a38939db87768fd048cd6d12323987adb9150ca7b159849`.
It was personally inspected before any new gameplay input. Original logs showed
paired native keydown/keyup delivery, including D release at batch4354.
No unfinished movement transaction was replayed.

## Visible continuation and its limit

Alice was upright on the broad timber platform facing the steam/plank approach.
Only short A/D alignment and W2/W4 approach steps were used, paired with releases
and separately reviewed neutral4/8 captures. Every recovery capture was personally
inspected. `approach_neutral4_2.png` showed her over the plank surface with the
broad platform behind. The final `plank_neutral4.png` at batch **4454** placed her
feet close to its right edge. Supported footing at the nose could not be
confidently established, so gameplay stopped there. This visual judgment does
not establish numerical origin, heading, ground contact or successful crossing.

No W+Space or Space keydown occurred. There is no thermal lift, south landing,
knife ownership, attack or target-effect claim. No damage/death was identified
visually; no trustworthy player-state observer was available to quantify health.

Command credits are not simulation seconds. Some immediate release images
changed little, while later reviewed neutral images showed movement/camera
settling. The native log confirms WM_KEYDOWN/WM_KEYUP delivery to the game focus;
that alone does not prove when the game movement loop sampled each state. Host
wall time continued while the game was frozen and while evidence was retrieved.

All recovery transaction receipts are error-free. The final shared counter was
**195**, including seven additional safety keyup requests and the original
supervisor's ordinary quit. The combined ledgers have 190 unique entries;
predecessor counter values **2,5,10,11,19** lack corresponding ledger entries.
The original counter remains authoritative; this gap is retained explicitly,
not presented as a complete original command transcript. Safety releases were
acknowledged without advancing more gameplay; the earlier paired movement
releases had already been delivered. The final safety acknowledgements do not
prove further guest sampling.

## Exit, recovery and lifecycle

The existing supervisor handled its ordinary-stop marker. Original game exit
was **0**, reason `ordinary-stop`, at **14:15:52.884969 UTC**, after
**1150.802909 seconds**, well within both original deadlines. No restart or
deadline extension occurred. The interrupted host launcher was reported terminal
143 with defunct Codex PID2922977; this recovery established the game remained
alive afterward. The launcher's interruption cause is unknown.

The runtime audit verified **235 pins**, no changes, exact original15/exact14
mapping preservation, matching actually instantiated module, and helper absence.
The archive contains **369 payloads**, all checked against their full SHA256
manifest locally before stopping the boat. Stored archive: **18,693,613 bytes**,
SHA256 `9b8d8643c8cf020180f7e47e9cf534c6de9b1d81d175d97a196252562d9a1b34`.
Decompressed tar: **26,757,120 bytes**, SHA256
`133fd129e97ba1006e5041c635f74cc62a23cc132ca8b8106b1116718d7bb462`.
Embedded gzip payloads were also decompressed and hashed; see
`archive-verification.json`. Accepted build/input tests were preserved, not rerun.

After local verification, a scoped `/proc` check found no original supervisor,
game or control helper; port8123 was closed. Delegated normal stop
`stop_5aa2732b9dbed7f2` completed **14:17:05.612 UTC**, `error:null`,
`forced:false`. Final explicit query confirms **STOPPED**, snapshot available
and verified. Original expiry remains recorded above; the stopped API clears
`archiveAfter`. No foreign box or lifecycle operation was used.

`RECOVERY.md`, `checks.json`, `historical-errors.json`, `archive-verification.json`,
the complete archive and lifecycle responses retain the recovery recipe and
honest limitations. This document is the only tracked change; no code/build
test was required. Next action belongs to the coordinator: review the historical
first-RPC failures and the footing limit before separately authorizing any new
campaign. This worker stops here and is not reused.
