# Shadow Man: originals restored; launcher capture blocked by helper error

Restoration is COMPLETE. Exactly the missing 238 files / 32,579,084 bytes
were transferred individually, sequentially, with supported snapshot Range GET
and upload-url/raw PUT. Each source SHA and destination SHA/size passed before
the next file. No transfer failure or retry occurred. The previously successful
1,845 files / 153,820,597 bytes and staged runtime were preserved and never
re-uploaded. Final independent remote rehash passed all 2,083 originals /
186,399,681 bytes and all 217 preserved immutable stage receipts.

Launcher/UI acceptance is INCOMPLETE. The ONE invocation reached the original
visible `ShadowMan Launcher` HWND0x10001. The ctl live snapshot exposes top-level
windows, not child control labels/IDs. My new `live_operator.py` mistakenly
waited for `Konfiguration` and `1024` in that snapshot. It failed at 7.435335s,
before issuing its PNG command. The trace independently shows creation and paint
of control1024, alongside1025 and3. This is an avoidable worker capture-helper
error, not proof that Konfiguration was absent or a guest capability failure.
The helper was not repaired/retried after this first capture boundary.

Counts: one guest session; one failed live-capture workflow; zero PNG commands,
zero PNGs, zero input dispatches, zero Configuration actions, zero response
captures, zero game/installer launches. No actual trap, exercised unresolved
ordinal, or native-seed failure was observed. Known COMCTL32/OLE32 nonseed
warnings were accepted, not used as stop reasons. No UI-image/gameplay/successful
guest-exit claim is made.

## Evidence and exact identities

`reconciliation.json`, `missing-238.json`, `completed-new.jsonl`,
`all-originals-verified.jsonl`, `after-transfer.json`, and `final-rehash.json`
establish original identity and progress. `first-transfer-failure.json` is absent.
`continue.py` records source-read exceptions separately from destination
HTTP/response exceptions, with phase, counts, partial lengths and class, without
logging signed URLs/tokens. The large dream_2.avi completed successfully.
Only necessary missing-file ancestor directories temporarily became writable;
successful original file content/modes were preserved; parents returned read-only.

Source/main remains exact58e90870a40a541a4083cae5e987ca8de31889e6; the thin index
preserves all8,279 base entries. Only base tree/commit objects were copied into
the fresh task repository; donor Git/history was not cloned. Prior accepted
evidence is66f3b56de14fd78601d1513bbbeb2ce537134d85. No source changes/build,
full-source compile, reinstall, optional DLL injection, registry spoof, workers,
merge or deployment occurred.

Final remote seals (`final-remote-integrity.json`):

| Artifact | Bytes | SHA256 |
|---|---:|---|
| canonical module |1879387|ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553|
| original registry |17088|d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3|
| D3DConfigUtility.exe |573440|850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0|
| mss32.dll |328704|09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c|
| dsetup.dll |135680|5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f|

## Gates and allocation

`hash_gate.py-result.json` and `preguest.py-result.json` passed full-original,
1959 accepted payload, registry,158-source,23-codec,27-data692498B,ctl,module and
native gates. DSETUP#11 and MSS seed were preserved. The fresh accepted fixtures
passed PNG round-trip,10 forwarding assertions,5 compile-rejection controls,
and real canonical WebAssembly.compile consumption. The actual guest also
consumed that module under the guard (`remote-module-consumption.jsonl`).
Dependency enumeration covered121 static JS files and explicit Worker roots;
excluded conditional compiler/GL/experiment modules are listed in the gate.
No actual child process/Worker was observed in this short session; do not infer
that every dynamic branch was exercised.

One896MiB hard tmpfs was mounted with uid/gid1000 and ordinary write/delete
probe before the single2045-file original VFS+registry clone. No reclone.
Four-route overlap projection885211136B passed939524096B cap; immediate
preguest projection876843008B passed. Immutable206127104B<2GiB;
fixed765952B<96MiB; sampled/final tmpfs183615488B<896MiB;
32MiB reserve remains inside total1GiB mutable. Remote free48837038080B.
Local admission initially62754816B including both actually reused whole donors,
tools/root/own allowances and8MiB reserve inside64MiB. `verification.json`
records final measured allocation including publication. Host floor2982150144B
passed. No local media/archive/full compressed layer was staged.

`remote-launcher-live-snapshot.json`, `remote-session.log`,
`remote-live-operator-failure.json`, `remote-watchdog-receipt.json` and
`remote-session-result.json` preserve the failed workflow. Endpoint was ready
at0.356498s; independent watchdog stopped/reaped PG37027 in7.671225s<90s.
OS parent exit=-9; guest ExitProcess was not observed. Owned groups and Node
processes are empty. The exported registry is preserved separately and is NOT
substituted for the sealed original. It has SHA256
3ca98c6099e95175208fcd09ca9977a90a34de94ce789189754a65e0941949fe.

The evidence checker passed with zero records because no registered Shadow Man
candidate exists; no unrelated dashboard result was invented. An initial checker
call used a root without scratch/runs and failed on that absent directory;
the final offline checker used a valid empty evidence root. This does not prove
rendering or input acceptance.

## Handback

bx_vufrds5w remains RUNNING (API idle, health ok, stop null), expiry
2026-10-23T01:36:17.590Z. Coordinator owns shutdown/checkpoint01:28UTC;
this task hands back before01:25UTC. No stop/delete/resume/snapshot request was
made. Immutable recovery and one clone are preserved. `RECOVERY.md` describes
the state; `publication.json` gives the pushed commit and independently queried
remote SHA. Task stops here; no new assignment or invocation is authorized.
