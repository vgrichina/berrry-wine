# LTris normal manual game and native Quit, 2026-11-17

The line-clear goal failed. One normal original game reached Game Over after
13 pieces with Lines 0 and Score 0. Original native Pause/resume and horizontal
piece movement were observed. A visibly selected native Quit was activated by
Enter, consumed at the native-input-return boundary, independently physically
released with ACK, and followed by native exit 0. This is neither a line clear
nor a score consequence.

Evidence: `scratch/runs/20261117-ltris-original-manual-line-clear-onward/result.json`.
Sixteen selected named whole frames are retained; redundant images were pruned
with their hashes and capture metadata preserved. No OCR, solver, symbolic board
memory, imported moves, configuration/save/clock/state changes or second game
was used. The default New Game screen showed Normal mode, level 0 and preview on.
Player 1 controls and global Pause P were personally reviewed in the original.

The authored SDL fixture first completed the personally reviewed full route:
black menu, green board, red Pause, green resume. Pause and resume reached native
consumption at capture ages 4.4916 and 3.5701 seconds. Both independent UPs
were acknowledged. Preparing a persistent operator before capture removed repeated
helper imports from the review-to-action interval; each action was still chosen
only after whole-image review. The five-second gameplay bound, 500 ms guarded
transport/ACK, 1750 ms independent UP and 3000 ms capture bound were unchanged.
Seven expired local intents across fixture and original remained NOT_SENT.
There was no actual runtime input/capture UNKNOWN on either working endpoint.

Preparation failures remain separate. An initial fixture paired the retained
module with a newer source/memory-map mirror and exited 2 before a control
endpoint. A preliminary original launcher then refused missing sealed candidate
metadata before starting the guest; no board, binding or input occurred there.
The small existing, hash-checked media metadata was added to the transient
inventory, and the authorized gameplay sequence subsequently ran. Neither
failure is evidence of a game input defect.

The working runtime reused matching published source `b29ef843aee74fe366aac3698704e3238797ed9e`
and retained module SHA-256
`533c599a144837890b6b45f6cbace2e52e9b4f48a3a8dd08b4261cd20223b1a1`,
with the published inventory resolver from `ad27fc08f`. Its owner had reported
focused resolution/startup/controller tests and a locked canonical build passing.
Those owned files were not edited. Actual compilation/Worker module receipts,
source inventories, relevant binary diffs and the existing compiled-source proof
are retained or hash-referenced. All 43 media references matched before and
after. This was not a test of an unqualified moving main module.

Native and independent watchdog actual waits have both EOFs; the watchdogs did
not fire. The working fixture was explicitly stopped after its completed route.
Its enclosing launcher and the original gameplay enclosing launcher returned 143
without writing their actual parent-wait records. That parent-wait/EOF gap is
explicitly UNKNOWN and cannot be reconstructed from absent PIDs or the native
wait. All named native/watchdog/supervisor PIDs are absent and listeners refuse
connections. Native Quit does not establish complete enclosing lifecycle proof.

No public runtime defect was proved, so there is no speculative runtime repair,
new build claim or affected-original retry. Only this report is committed.
Home free space remained above 1.5 GB at recorded checks. No workers, boxes,
source archives, media copies or deployment were created; foreign WIP and held
investigations were preserved. Box ID/expiry are null, state NOT_CREATED and
stop receipt NOT_APPLICABLE.

The gameplay allowance was used. A further original attempt needs renewed
authorization, and its enclosing launcher must durably retain actual parent
waits and both EOFs. The line-clear/score criterion remains open. Release/stop.
