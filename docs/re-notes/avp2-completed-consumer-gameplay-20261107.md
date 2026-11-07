# AVP2 composed-consumer gameplay prerequisite, 7 November 2026

Marine gameplay remains unverified. **No original box was allocated and no
original was launched.** Local qualification exposed an input-release defect in
the preceding run's driver. Its run-local successor is repaired and tested;
this bounded assignment stops before allocation as instructed. The entire
staged original entry has not qualified, and the generated adapter controls
below must not be described as that qualification.

Evidence: `scratch/runs/20261107-avp2-completed-consumer-gameplay/` (ignored).
Tested source: `994008917622964e3ae9768c0bf3e6802607c480`, Chrome
151.0.7922.108, local headless Chromium. No emulator source changed. The
published `attachPinned` implementation, collector and consumer observer were
used directly without transport substitutions or modified guest bytes.

## Local closure and preserved faults

`chromium-workers.cjs` extends the preceding generated consumer controls with
real `/lib/guest-worker.js?v=dev` and `/lib/d3d-render-worker.js?v=dev` Workers.
The production adapter attaches their actual CDP sessions before execution and
collects their actual source/import responses. Both Workers execute their
top-level scripts and install their message handlers. These are actual browser
Workers, but **neither is initialized with an emulator module or a guest**.
This does not prove game-process ownership, renderer endpoint ownership,
instantiated WASM identity, GL provider, or the entire staged original driver.

The fixture is the predecessor's generated 57,344-byte body, SHA-256
`509e350e05a572b1353fe40739100f48bec03145f1a5529d2a095ae051cd346e`.
Correct original fetch consumption through EOF and arrayBuffer passes. No
clone, tee, second fetch, HTTP fulfillment or synthetic success is used.

`workers-pair19-on-stream.json` records a natural Chromium ERR_ABORTED, not an
injected event. The body was captured at sequence313, continued316,
canceled318, and independently recorded as completed by the consumer322.
`audit.py` verifies matching session, target, Network/Fetch IDs, native
initiator token, context ID/unique ID, frame, document URL/timeOrigin, length
and hash. The application's own returned-byte check also passes. Nineteen
bounded paired samples encountered this order; this is not a frequency claim.

`workers-default-baselinepair2-on-stream.json` preserves the opposite result:
the actual consumer reaches correct EOF, but the unchanged default policy
rejects the natural ERR_ABORTED. Eleven real-browser negatives remain rejected
with both Worker scripts running: headers without consumption, ambiguous
reader, deadline, uncovered resource, all bytes followed by cancel before EOF,
AbortController, wrong bytes, empty body, truncation, detach and document
replacement. The collector's 129 synthetic lifecycle regressions also pass,
including sticky failures; these are separately labeled synthetic CDP tests.

The legacy sealed adapter fixture still fails on its historical
`lib/process-boot.js` and `lib/browser-shell.js` ledger hashes, as documented by
the preceding task. `legacy-adapter.log` preserves the exact failure. No seal,
optional-resource policy, cancellation default or unrelated source was edited.

## Demonstrated prerequisite and repair

The previous `gated-controls.cjs` awaits DOWN before starting its hold delay;
UP only runs afterward in `finally`. `input-controls.test.cjs` sends a real
trusted Chromium KeyW DOWN, then deliberately withholds its acknowledgment.
At180ms for an80ms hold, the old helper has sent no UP. Resolving the test's
withheld acknowledgment is necessary for its eventual release. This is a
harness acknowledgment experiment, not an observed emulator failure.

The owned run-local `gated-controls.cjs` arms UP before issuing DOWN. Expiry
with unknown DOWN closes the existing serialized Gate; queued Enter is never
sent. Release attempts for different keys start independently, UP acknowledgments
have a bounded deadline, and a rejected/unknown UP is retained without retry.
No input is replayed. Actual Chromium fail-before/pass-after controls prove
trusted UP despite the withheld DOWN acknowledgment, empty held state after its
acknowledged release, and ordinary serialized successful input. Focused opposing
controls cover permanently unsettled keyboard/mouse DOWN, rejected or stalled
UP, no queued input, no duplicate UP, and identity rejection before any DOWN.

The first test double accidentally withheld the queued baseline Enter too.
That generated test stalled; its exact owned test/browser process tree was
terminated and the error retained in `input-test-setup-error.json`. The corrected
test withholds only the tested KeyW acknowledgment and closes normally.
This did not involve any guest, remote box or original input.

`staged-browser.cjs` retains the previous actual browser driver's logic and
uses production `attachPinned` with the exact AVP2.exe consumer URL selected.
Its same-directory controls dependency resolves to the repaired helper.
`entry-amendment.patch` records the narrow driver change. It has not been run
against the original or established complete strict owner/context/module/window/
epoch/freshness admission. In particular, Worker script startup above cannot
substitute for instantiated-module or live input-owner verification. The old
driver's failed release prerequisite disqualifies allocation; repairing that
prerequisite does not silently authorize skipping full composed qualification.

## Fixture, recovery and cleanup

All18 original fixture sizes and SHA-256 hashes pass. `audit.json` references
each original path/hash and verifies the registered manifest has exactly17
companions, excluding AVP2.exe, with no generated command override. Original
autoexec.cfg and Profiles/Default.prf remain unchanged. The actual registry ID
in this checkout is `avp2_demo`; its documented direct route is
`index.html?candidates&app=avp2_demo`. There is no registered `avp2` alias;
neither registry nor original configuration was changed to create one.

`audit.json` pins all21 served Worker/runtime source files, verifies their
current bytes against the actual HTTP receipts, and retains full consumer
identity/order. `source-base.txt`, `source-diff.patch`, `new-files.patch` and
`entry-amendment.patch` preserve Git provenance and relevant amendments.
Run-specific inputs and their focused tests remain alongside the logs. No
source tree, media or binary archive was created; game media is referenced by
existing path, size and SHA-256. `artifact-inventory.json` records evidence
size/hash verification.

Reproduce the retained checks from the checkout root:

```sh
node tools/verify-avp2-recovery.js
node test/test-candidate-browser-manifest.js
node test/test-browser-response-body-collector.js
node scratch/runs/20261107-avp2-completed-consumer-gameplay/input-controls.test.cjs
node scratch/runs/20261107-avp2-completed-consumer-gameplay/input-opposing.test.cjs
python3 scratch/runs/20261107-avp2-completed-consumer-gameplay/audit.py
```

Fresh generated consumer samples can use `PREFIX=new- CONTRACT=1 node
scratch/runs/20261107-avp2-completed-consumer-gameplay/chromium-workers.cjs`.
`LABEL=new- node .../paired-workers.cjs` searches at most60 samples for the
natural positive cancellation; `BASELINE=1 LABEL=new-default-` selects the
unchanged default. The audit intentionally checks the retained filenames.

All owned Chromium processes/profiles are absent; all22 recorded HTTP ports
refuse connections. The owned board watcher is closed on release. Free/home
remains above2GB. Box ID, state, expiry, shutdown delegate and normal-stop receipt
are not applicable because allocation never occurred. No old box was accessed,
stopped, resumed or deleted; no public deployment occurred. No screenshots or
gameplay inputs were produced, and there is no rendering, FPS or parity claim.

The remaining boundary is complete staged-entry qualification with the repaired
input helper and actual initialized owners/modules, before a separately scoped
original session can seek the launcher/menu, Marine world, visible movement and
an attack/target consequence. None of those original checkpoints was reached.
