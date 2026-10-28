# PASS: focused observer invocation correlation, unit/source boundary only

Exact read-only candidate: `efa0f32e9dbe7fac2c863737810755473cb458c6`.
The unchanged exported `install` in `lib/morrowind-name-observer.js` passed
49 independently designed public-hook challenges and two rejecting mutations.
This independently qualifies the tested correlation behavior to accompany a
separately accepted arming correction. It does **not** accept the original
candidate's known quiet-startup defect, or qualify any runtime execution.

`correlation.js` requires the exact production observer (SHA256
`a2bbe6d15de3fc46d65f6e72e365e82cd223b5db5486dc3cdbc585aad9d75799`).
Installation itself validates all six production source blob pins. The test
reads the real 3,907,584-byte original EXE, SHA256
`f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676`,
and independently maps its PE sections to supply the five loaded-code anchors.
It starts at the exact exported installation boundary, then calls the returned
public hooks with explicit registers and four bounded 64KiB memory regions.
There is no production logic replacement or runner normalization in passing
groups. Mutation controls alone compile two explicitly changed source copies.

Coverage includes:

- Positive event delivery and setter pre/post observations; successful HRESULT
  with count1; failure HRESULTs, success-with-count0/2/UINT32_MAX reject stale
  event reads and cannot deliver callbacks.
- Nested unrelated API exits cannot steal the owning invocation; unrelated API
  names and invalid stack layouts cannot become polls. Two nested devices retain
  distinct invocation IDs, with the outer final completion owning delivery.
- A different TID cannot pop the owner's API frame, translate, deliver or set
  its target. TID2 has its own positive control. Missing return boundary, stale
  ESP/EAX, repeated boundary, a new polling block, or a new invalid invocation
  cannot reuse an old completion. Delivered callback tokens are single use.
- Same-pointer/new-pointer/new-thread builders and submission boundaries expire
  prior callback authority. A new generation during an outstanding API rejects
  its completion. Callback message, character and target mismatches reject.
- Setter pre-observation is actual callee entry `5726c0`, not interior CALL
  `6385e6`. Post-observation requires actual return `6385eb` and ESP+20
  (`ret 0x10` including return address). ESP+4/+16/+24 and wrong target/return
  reject. Actual callback return expires setter authority.
- Later changed text is explicitly a sample with `firstWriter:null` and an
  unobserved-writer limitation. No arbitrary writer attribution is accepted.
- Record128 is overflow and stops observation; throwing read emits unavailable
  then stops; throwing sink stops safely without escaping.

The independently designed mutations collapse all TIDs to1 and retain an already
delivered poll token. The unchanged challenges reject both: cross-thread false
delivery and duplicate callback respectively. Positive controls pass against the
unmodified production export. The per-case list is in `results.json`.

The predecessor rejection at
`scratch/usage-watch/morrowind-observer-independent-accept-oct28/receipt.json`
is reused unchanged, including its passing production-fragment controls and
known quiet logger reset. Its report commit is
`7b566aefba27e48b6d0dcd815ea24b47bfe2b00e`. Those groups, the earlier32 source
contracts,20 anchors/22 controls and17 transport checks were not rerun here.
No arming predicate was changed or reaccepted. Direct callback driving is an
explicit unit boundary and does not prove the runner will dispatch callbacks.

No whole runner, WAT, guest initializers, canonical module, game, browser, build
or Boat ran. Destruction/address reuse outside observed builder generations,
arbitrary later writes and historical text-loss causes remain unproven.
Synthetic sequence rejection does not prove all real instruction sequences
are observed or that the runner and compiled hooks agree. Separately accepted
arming plus source-matched full-runner/module/initializer and authorized runtime
acceptance are still required. No original-game diagnosis was attempted.

Reproduction requires the captured supervisor/resource controls and real pinned
EXE supplied separately; no executable is redistributed:

```sh
/usr/bin/node --max-old-space-size=320 \
  test/morrowind-observer-invocation-correlation-accept-oct28/correlation.js \
  /READ_ONLY/installed/Morrowind.exe
```

Portable canonical evidence is
`scratch/usage-watch/morrowind-observer-invocation-correlation-accept-oct28/`:
receipt, archive, input identities, exact Node startup/limits, per-operation
admission and supervisor records, and recovery recipe. The task used strict
configured GitHub SSH and publishes only this new test/report directory.
The first checkout hit an incorrectly applied Git file-size cap; the second
whole-directory checkout stopped at the allocation reserve. Those incidents
are retained, and checkout was reduced to exact files without increasing the
64MiB allocation. Initial combined policy reads also exceeded the terminal
capture budget; no whole-task resource-compliance claim is made.

No production repair, merge, main integration or public deployment. Root and
donors were read-only except the append-only coordination board. No workers
were spawned. No box was assigned; lifecycle remains coordinator-owned.
