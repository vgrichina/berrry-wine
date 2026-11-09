# Drakan 0700: refusal evidence retained; actor qualification unresolved

No concrete actor schema/identity mismatch is provable from the retained 0635
original. **Actor qualification is not repaired. No original or T retry is
authorized.** The first failure at 2026-11-09T06:49:29.396Z remains terminal.
The live tuple was not persisted before the conjunction, and no retained
preterminal artifact contains its values. A passing synthetic actor cannot
replace that missing original sample.

The exact unresolved predicate set remains:

```js
live.base === base
live.back === live.object
live.vtable === base + 0x150b20
live.endpoint === identity.endpoint
live.slot === 0
live.process === identity.processId
live.epoch > 0
live.root > 0
live.token > 0
live.thread > 0
```

It is impossible to name the individual failed operand from these artifacts.
No pointer, base, slot, owner, epoch or token is inferred or substituted. The
missing evidence is the **returned live tuple for that exact failed read**,
before the assert. Earlier capture identity is insufficient to reconstruct
the actor/backpointer/vtable or that later Worker sample.

## Offline source and evidence reconstruction

Evidence is `scratch/runs/20261109-drakan-live-identity-repair-0700/`.
Starting Git base is `2f53caa14ee09b395523a744a8f0fd92dedcb0c1`; the run records
its small relevant binary diff, including new tracked files and the ignored
recovery entry point. Git remains the source archive. No source tree, module,
media archive or duplicate binary was created.

All **398** retained remote artifact references were independently reread by
size/SHA256; 19 nested gzip streams also decoded successfully. The original
caller is recovered from its existing input patch, SHA256
`2a35f43b1957bb0267fc191cab99c886b4e784854c2146a67b17c54ec9427c89`.
Its Worker read expression is byte-for-byte present in the tracked caller.
The current observer/adapter, Worker, region map and custody source match the
0635 published source. The page bridge is promoted unchanged.

The current Worker observer uses `endpoint`, `slot`, `process`, numeric shared
epoch, root/token diagnostic exports and thread ID with the same pointer chain
and base/vtable/backpointer checks as the caller. The retained capture supplies
`endpoint=1`, `slot=0`, `processId=1000`. Its page epoch is a UUID, distinct from
the Worker's shared numeric epoch; the caller does not compare or substitute
those two identities. No concrete schema disagreement was found.

Admission `a331104e9`, selected CPU
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`
(2,185,596 bytes), and custody
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`
are unchanged. `retained-audit.json` references the accepted observer/browser/
Worker/native proofs by SHA256 and preserves their prior scope. They are not
new actor or native qualifications.

## Reusable caller and tests

`tools/drakan-real-caller.cjs` promotes the actual caller into tracked code;
`tools/drakan-caller-page.js` promotes its actual page bridge. The ignored 0635
caller now delegates to that implementation with its independently pinned
media manifest. The old manifest is historical evidence and is deliberately
not rewritten into a newly runnable closure. Historical `prepare.py` still
reconstructs the historical caller; any separately authorized successor must
explicitly stage and pin the tracked caller and helper. Nothing here authorizes
running the recovery recipe or original.

`tools/drakan-live-identity.cjs` saves all ten operand names, actual values and
types, expected values and types, operators, individual results and the complete
failed set **synchronously before throwing or permitting down**. A persistence
error also refuses admission. Undefined values remain distinguishable from null;
BigInt/nonfinite diagnostic values have explicit representations. The exact
original predicates remain intact, including strict base and slot equality.

There is also a concrete cleanup correction: physical release rejection now
clears the private release binding in a nested `finally`, after joining the
release Promise. The original rejection still propagates. This correction does
not explain or repair the pre-T actor refusal.

`node tools/drakan-real-caller.test.cjs` composes the real caller and page bridge,
independently verified installed EXE/RFL pins and actual selected CPU bytes.
The actual Worker read expression executes against synthetic shared memory,
through a CDP-style JSON return boundary, rather than returning a hand-written
`live` tuple. Only read-only diagnostic export fixtures are used; no WASM guest,
Chrome, game or native input executes.

The 16 composed scenarios cover COMPLETE, UNKNOWN, release rejection, wrong
actual module owner, each of the ten identity operands, string slot and missing
slot. Every identity refusal has zero down/up/bridge/observer starts. Admitted
controls retain one down/up, original start, timestamp, release completion and
joined bridge/observer cleanup. Release rejection retains its error and the
private closure cleanup is verified without another input. Additional controls
cover multiple failed operands saved before throw, persistence failure and
**100** comparisons against the original predicates.

The retained old caller fails the new saved-record expectation; the tracked
caller passes. This is an old-FAIL/new-PASS **diagnostic regression only**, not
an actor semantics repair. The first baseline attempt had a loader-path error;
the corrected `legacy-v2-*` evidence identifies the missing record precisely.
The first locked build was refused by the concurrent peer's owned host.js
producer hash. No peer source was changed to bypass it. After that peer's
producer review, **`flock /tmp/wine-build.lock bash tools/build.sh` passed**.
`locked-build-final-wait.json` records the actual successful wait and both
stream EOFs; `build-source.json` and its small shared-state patch record the
concurrent source used by that build. Focused final tests also exit 0.

## Stop condition

The remaining blocker is the absent exact original live tuple. Without that
already-retained read, narrowing the failed operand or repairing actor semantics
would require speculation or a new guest execution; neither is authorized.
All owner/module/native lineage, preCPU/preDLLmain, work ACK/held/freshness,
exact32/CALLRET and timing ceilings remain in place. No Redline, Quake2 or
native custody provider was edited. No agents/workers were launched.

This task created **no box**: ID=null, state=NOT_CREATED, expiry=null,
stop receipt=null. The earlier 0635 box remains the historically recorded
ARCHIVED/PHYSICAL_DRAINED box; it was not accessed. Logs are gzip from their
first stored byte. Local test/build processes and the board watcher are joined;
free `/home` exceeds 1.5 GB. Release owned files and single-task STOP after
the focused tests, locked build and explicit own-path main commit/push.
