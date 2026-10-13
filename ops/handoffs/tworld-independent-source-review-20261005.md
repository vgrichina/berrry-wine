# Tile World independent source review — 2026-10-05

Reviewed snapshot `scratch/new-game-tworld-20261004/repair/source-review-final`, patch606fd2b008a69956693837a047c45dd8a0a65862c578b15ca45b4c66ba66c3f7. Coverage owner confirms working after-sources match. Read-only; no tests/compiler/browser/production edits by reviewer. Earlier integrated actual Worker/WAT receipt and new focused JS receipts are evidence supplied by owner, not independently rerun.

## Blocking: replacing queue while its pump awaits duplicates unrelated deliveries

`after/lib/host-audio.js:3717` wave_out_close reassigns `waveFunctionDoneQueue` using filter. `_pumpWaveOutCallbacks` at3898 captures `const q` and awaits `ctx.offerWaveCallback(item)`.

Concrete interleaving: queue[A1,B1], pump offers A1 and awaits; another owner closes B. Close copies survivingA1 into replacementqueue. OfferA1 accepts; pump shifts oldq, leavingA1 in newliveq. Nextpump sees A registration stilllive and obtains a **new token**, so Worker exactly-once retry protection cannot prevent secondcallback. Closing an unrelated stream with no queuedheader also clonesA1. No malicious messages required, only normal cross-owner close while admission awaits.

Fix preserve shared queue identity using in-place compaction/removal, or explicitly reconcile exact item against currentlivequeue after every await. Prefer in-place so all existingreferences remainvalid. Test actual hostaudio module: deferredacceptedofferA, closeB duringawait, resolveA, pumpagain, assertAadmittedonce/queueempty; also deferredambiguousA and closedA preserve originaltoken cancellationquery. Sent finding to coverageowner/root before qualification.

## Acceptable browser scope, with explicit limitations

* Registration carries callback/instance/handle plus Worker generation and exact link identity; header completions bind immutable registration/submission rather than laterWAVE_OUT_SHARED. Good protection against stalehandle reuse and wrongopener.
* Cross-ownerclose retires hostregistration/queue but leaves original Worker's map entry untilownclose/stop. Host prevents fresh offers; cancelled ambiguous retries query alreadyacceptedtoken before retirement without rerunningcallback. Thus this is not byitself proof of stale callback execution. However repeatedcrossowneropen/close can grow metadata on both Worker/WorkerLink for distincthandles; needs generation-qualified retirement ACK/cleanup for general long-lived use. Bounded onegame qualification may proceed after queuefix with this limitation disclosed; don't claim bounded lifetime globally.
* `_waveOffer` blocks scheduler use of oldcachedyield until admission is known; exact same token/body retained on transport ambiguity. Good fail-closed policy. Permanent transportfault intentionally stallsowner; report as diagnostic failure rather than silentlyfreshretry. No liveness claim across permanent channel failure.
* WAT `fire_wave_out_callback_bound` accepts only liveEIP/ESP and yield0/1, rejectsnestedMM/wave callbacks. It saves wait_handle/handles_ptr/all/timeout/stack_bytes/yieldreason/flag, then saves caller registers. Returnthunk restores caller andwait; it does not substitute a synthetic MMtimer TLScontext, preserving owningCPU/TLS. Browser hosts separately preserve wait bookkeeping. Exit/trap path discards suspendedcallback state rather than restoringdeadthread. These are appropriate invariants, contingent on final real-WASM regression succeeding.
* Pending/suspendedowner must retaincompletion, notretire it. New focused owner-lifetime/pending-step regressions cover that sourcecontract; finalcandidate actual dependencychain still needs owner-runvalidation and ordinarygameplay.

## CLI real-thread compatibility: not established

`test/run.js:6579` invokes only `ctx.pumpAudioCompletions`. It does not use browser `_offerWaveCallback`/pumpboundary. Candidate hostaudio fallback delivers only when registrationowner.kind=cooperative and owner.exports===ctx.exports. CLI real-Worker registrations do not acquire browser's `audioRpcSlot` ownership getter/offertransport merely by updating WATsignature. Therefore no claim this repairs CLI --threads; it may retainundeliveredfunctioncompletion. `test/run.js:4429–4452` cooperativeworker uses dynamicexportsproxy and separatelyconstructedhostCtx; sharedqueuehead belonging toanothercontext mustnotbeexecutedby maininstance, and matching pumpcoverage must be explicitlytested.

Before production generalization: actual CLI --threads callback fixture mustassert either correctowningdelivery or explicitunsupported/retainedstatus with no shadowcallback, and unchangedcooperative callback behavior. Missing wiring is not license to weaken EIP/ESPguards or label unloaded-instanceunit tests gameplay. It neednotblock privatebrowserqualification oncequeuebug fixed and finaldependencychainpasses; it does block claiming cross-hostcompatibility.

## Review outcome

Hold candidate acceptance pending queueidentity repair/regression. No speculative TLS or ownerstate patch requested. Re-review exactdelta with coverageowner; root can then use finalactualowner/WAT chain and boundedordinaryTile route to advance qualification. No commit/staging performed because sharedintegration remains root/ops-dashboard-owned.

## v2 re-review — GO for bounded ordinary browser qualification

Reviewed `repair/final-validation-20261005/snapshot-v2/after/lib/host-audio.js`, SHA256 `3b2e7ba0a32def742e6840ac2a34bbc0fcb198a20af140f3b0cb0b2635abd344`, against original source-review-final. Sole delta replaces queuefilter assignment with backward in-place splice for retired registration, retaining ambiguousoffer items. Shared queue identity survives the await: pump shifts the same livearray; unrelated accepteditem cannot remain in a clonedqueue. Prior blocker resolved.

Read actual regression source and bothlogs: deferredofferA, closeotherB, resolveA, then secondpump asserts emptylivequeue and admissioncount1. Beforecontrol fails `actual1 expected0` on exact retainedaccepteditem. Independently rehashed all five logs against finalreceipt: integratedv2PASS, beforequeueexpectedFAIL, ambiguousclosePASS, queueidentityPASS, beforeidentityexpectedFAIL. Integratedlog confirms actualqueue→ownercallback→semaphoreWorker→naturalexit→mainjoin. I did not rerun tests or compile.

No remaining identified source blocker for **bounded browser gameplay qualification** after root integration/build grant. Not a claim gamealreadyworks or generalreleaseacceptance. Cross-owner metadata retention and CLIreal-thread compatibility limits above remain; do not suppress them. Preserve finalmodule/servedsourceidentity and require ordinary Tile selection plus visible player-controlled board before qualification. Reviewer available for result/screenshots when produced. No edits to coverageowner files, no staging/commit/runtime.
