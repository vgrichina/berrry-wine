# TR2 native publication progress — 2026-11-08

The first new installed arming boundary exposed a production race. Concurrent
`WineAssembly.armD3dimPublicationObservation()` calls on an idle live browser
GuestWorkerLink both failed: the second call replaced and invalidated the first
call's writer epoch before its render acknowledgement arrived. The first call
then rejected `owner changed while arming publication observation`; the second
rejected `producer observation already armed`. This was an observer lifecycle
failure, before any original-game execution or performance measurement.

`host.js` now reserves arm admission synchronously through the asynchronous
render acknowledgement and releases that reservation in `finally`. A concurrent
call rejects before attaching or replacing writer coverage. The first call
keeps its epoch and can publish. This changes admission only: the synchronous
command wait handoff and writer, freshness, page, canonical, palette and lifetime
checks remain intact. The host callback census records this reviewed change;
callback ownership remains pending.

Evidence: `scratch/runs/20261108-tr2-native-publication-progress/`. The baseline
is published `4ed4f0b5bb172dd18182692f1df7f13c9dea41bf`, including `f50c6d32e`,
`49874a81c` and `663f1c139`. All 315 audited tracked runtime/compiler source
files match that published closure except the owned host correction. The
untracked peer `lib/wininit-boot.js` is outside the loaded closure. Loaded
browser source hashes, fixture module identity, exact Git SHA, relevant binary
diff and owned new-file patches preserve recovery without a source/media archive.
No game media was opened or copied.

The new browser regression uses the installed host arm method, actual shipped
guest/render Workers, production native queued flip/fence, canonical conversion
and canvas publication. It requests the legacy WebGL endpoint with SwiftShader;
this is a small fixture, with no original-game or GPU throughput qualification.
The pre-fix failure and its two raw rejection messages remain in
`lifecycle-before.json`. The regression command is:

```sh
HANDOFF_LIFECYCLE=1 node test/test-d3dim-command-wait-handoff-web.js
```

The corrected control requires first-arm success, concurrent refusal, a valid
unchanged owning epoch and one exact source/request/canonical/display row for
one raw source record, with an empty discard ledger. It then uses the existing
diagnostic producer stop, Join retirement and local coverage detach operations.
An ordinary unarmed native flip still produces all four red-34 pixels and adds
no observation record or publication row. The retired Join cannot silently
rearm. Render-manager retirement adopts its heap, and the owning guest Worker
stops. This does not introduce a public WineAssembly unarm method or certify
supported same-process rearming. All recorded browser processes close normally with
exit 0 and absent Chrome PIDs. The first post-fix run's incorrect expected
red-17 pixel assertion is retained; the next alternating flip correctly yields
red 34. No production rendering change was made for that fixture correction.

The locked full build passes, as do the focused production association and
direct synchronous-command handoff suites. The accepted four-qualified/four-
discard browser controls were reused as evidence and were not launched as a
separate repeat acceptance task. Existing poststore/prewatch and outer-writer
exclusion controls remain binding. Heavy local runtimes use
`/tmp/wine-runtime.lock`; the build uses `/tmp/wine-build.lock`. Each browser
run has an external GNU timeout independent of its browser/Node event loop.
Available disk remains above 5 GB.

This task stops at the requested substantive tested correction of the first
new integration blocker. Full observer baseline/unarmed/armed matched raw
trials have not been run. The older import-wrapper and command-RTT costs remain
partial measurements. There is no gameplay, simulation-clock identity or FPS
claim, and no empty-Join-to-zero-FPS inference.

Next: qualify the remaining full observer cost path with per-run identities,
retaining every source disposition and using fresh processes where retirement
precludes rearming. Then allocate the one watched UUID-idempotent original and
follow native Graphics default-OK Enter into Venice, as documented in
[the accepted startup/control route](tr2-default-ok-activation-20261108.md),
before bounded visible movement and a reviewed weapon consequence with exact
publication joins. Full27, parity, audio and FPS remain open.

Box ID/state: **not allocated**. Expiry and stop receipt: **not applicable**.
No old box was resumed, stopped or deleted. No original, public deployment,
subworker, private input handler or game/clock/configuration patch was used.
