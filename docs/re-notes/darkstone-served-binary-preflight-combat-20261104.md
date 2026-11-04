# Darkstone served binary pins and bounded software route, November 4

Run-only served pin coverage is repaired in
`scratch/runs/20261104-darkstone-served-binary-preflight-combat/`.
All **1,424 predecessor comparisons are preserved**, with three independently
verified additions: canonical `build/wine-assembly.wasm` SHA-256
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`
(2,143,712 bytes), companion `build/wine-assembly.compat.wasm`
`74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`
(2,146,325 bytes), and `test/binaries/dlls/comctl32.dll`
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`
(577,808 bytes). Prepared source remains
`2e802c7dfbb41dec726b7e69d580aba316cc48d2`. No production source,
modules, media or game configuration were restaged or changed.

Before Chrome, an inventory of the predecessor's 310 served requests / 299
unique paths plus the companion produced **300 actual localhost GETs**, each
checked against the extended manifest. The same HTTP guard checks hash and
length. Exact-guard omission, wrong hash and wrong size tests passed before
Chrome; supplemental actual HTTP negative tests after browser cleanup each
returned 500. The observation wrapper rejects noncanonical byte compilation
and instantiation before native execution. The driver also treats the host's
WAT fallback warning as a halt and refuses a successful startup ACK after a
safety failure. Focused mocked fallback tests passed. Guards were strengthened;
no substitute module was allowed. The companion was verified, not executed.
Missing optional `stdole2.tlb` requests returned 404; those nonexistent files
were not represented as pinned bytes. Their console/HTTP records are retained.

Inherited quoting, file-based manifest transport, atomic command publication,
startup/prior ACK gates, capture and recovery helpers were reused. Before
runtime, syntax/import/isolation, the exact worker expression, delayed startup,
sequential ACK, failed-ACK gating, capture bytes/state/fresh names, bounded
steps, binary recovery roundtrip and the 8,000-record manifest tests passed.
The first remote capture test lacked its uploaded driver; that setup failure
is preserved in `remote-commands.jsonl`, then the helper was uploaded and the
test passed before Chrome. A supplemental HTTP-negative test incorrectly
called the Fetch response's numeric status as a function; its failure is also
retained, corrected and tested without reopening Chrome.

Software opened once at 03:30:23Z. Page compilation and instantiation identify
the supplied canonical module, followed by transmission to guest Worker 0;
worker observation records receipt and instantiation. Recovered actual bytes
match the full canonical hash above. All **213 served-file guard records** passed their
pins. No fallback, runtime halt, failed command ACK, reload or relaunch was
observed. All **171 commands** have matching ACKs; **104 step requests** ran
**5,772 steps**, maximum **64**. The 38 observed DOM input events are trusted
and balanced: six key down/up pairs and thirteen mouse down/up pairs, including
the Launch pair. Ordinary menu clicks, CODEX warrior creation and party
selection reached the original **Town** world/HUD. Native F input produced the
visible **Combat Man** label in the personally inspected `manual-town.png`.
Its owning renderer Worker endpoint 1 reports legacy/software and **189,916
completed software draw calls**; toolbar selection alone is not the evidence.

The reviewed Town-road click was followed by a black exit-transition capture.
Another bounded 256 steps still yielded black in `exit-settled.png`; the
filename does not establish a settled world. **Ardyl arrival, skeleton torso
aiming, enemy defeat and surviving-player combat are unproven.** There was
insufficient remaining browser/recovery time to continue. WebGL was not
launched: the inherited ten-minute remaining-TTL guard could no longer pass
for a sequential second arm. Historical `4649ee5f…`, EXP 0→79 and LIFE 17/35
remain old evidence. No parity, FPS, audio or full-game claim follows.

All **544 then-existing files** were recovered and SHA/size checked before
quit, including the actual canonical module. Final recovery verifies **548
files**. Chrome PID 40442 exited **0** at **03:35:49.091Z**, about 325 seconds
after launch, with acknowledged quit. The driver is absent and private port
44237 is closed. All **1,427 pins**, including the 15 original media files,
remain unchanged after runtime. Box verification returns **RUNNING/APIidle**,
health `ok`, hydrated `true`, expiry **2026-11-04T03:42:18.748Z** for
`bx_92ssqvkw`; shutdown ownership returns to the coordinator. Recovery and own
helper closure completed before 03:37Z. No lifecycle action, subworker, public
deployment, guest-memory write, cheat or source/media archive occurred.

Evidence includes the checkout Git SHA, relevant binary diffs, new-file/helper
patches, complete pin/fetch inventories, negative tests, ACKs, captures,
module bytes and cleanup reports. Predecessor evidence is untouched. Only this
investigation note is committed; run-only helpers/evidence remain in the
ignored run directory. The next authorized attempt can reuse the tested pin
coverage and control transport, but needs enough lease time for the original
Town→Ardyl transition, inspected combat, recovery and sequential WebGL arm.
