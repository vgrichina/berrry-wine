# SimGolf championship caller: terminal failure repair

Run `scratch/runs/20261110-simgolf-native-hole-finish-0520/` repairs a
preallocation harness defect. No original game or new box was launched, and
no completed Dolphin Coast hole, score, Gary career or tournament win is
claimed. The accepted Sid stroke and later wedge remain described in
`simgolf-native-championship-shot-20261108.md`.

The retained caller's terminal catch invoked `close('first terminal failure')`.
Executing that complete original close function in an offline control records
two `Runtime.evaluate` operations followed by `Browser.close`. Its serialized
review chain and numbered transport also allowed a fresh capture after a
stale refusal. Both behaviors conflict with this task's first-failure rule.

`tools/simgolf-native-hole-driver.cjs` composes a separate SimGolf caller from
the hash-pinned original. Its terminal guard records the first error, clears
admission, rejects pending calls and signals the explicitly identified owning
parent once. Subsequent protocol, capture, input and close calls fail before
dispatch. Runtime exceptions, unexpected browser exit and observed guest death
also cancel. An unchanged expected post-input image is terminal. Run-local
bound-input and transport variants make stale refusals terminal. Shared runtime,
providers, Nox/LBreakout helpers and retained inputs are unchanged by this work.

The focused test executes the complete emitted command function, including
an ordinary click admitted through the serialized identity/review chain and
an instance installed by the current `lib/guest-worker.js` installation block
using the current compiled module. Other offline cases cover stale/changed
identity refusal, rejected/pending DOWN and UP, independent release before a
delayed DOWN ACK, unusable/unchanged captures, asynchronous guest death, and
wrong/stale numbered ACKs. Failure cases cancel once and refuse later protocol.
These are authored controls, not original guest gameplay or live lifecycle
qualification; host function imports in the isolated installation control are
inert. The guard's cancellation callback is observed without signalling a real
parent during tests.

The run's production-resolver mount control passes against current
`lib/browser-shell.js`, registry and merge implementation. It preserves all
1,762 original manifest entries and verifies the actual `/test/binaries/...`
URL, the original 86,831-byte CSE (`beac714ef16e3574a517c272e5d99b495b1b9eec0f4a4b4e726f121b1eb74cca`)
and original zero-byte marker. The old wrong-URL handler fails this control.
No media is copied or modified.

Validation: `node tools/simgolf-native-hole-driver.test.cjs RUN`,
`node RUN/mount-controls.cjs`, and
`flock /tmp/wine-build.lock bash tools/build.sh`.
Exact results, generated pins, Git baseline and relevant binary patches remain
in the run. This is a supported caller repair, not allocation authorization or
proof of a playable first-hole finish. A subsequent native attempt must still
qualify the complete request-client/owning-parent cancellation path and leased
watchdog, evidence custody and separate parent/watch EOF waits before allocation.
The composition intentionally requires an explicit owning parent PID; it does
not establish that a particular launcher supplies the required ownership.

The final two current-request ACK controls identify a concrete remaining
preallocation blocker. With a wrong current ID or a missing ACK, the actual
request helper writes `transport-closed.json` and rejects, but the consumer
polling the next absent command returns idle. It has no owner-cancellation
notification. Thus client refusal alone does not satisfy immediate owning
cancellation. `focused-tests.json` records both cases as
`requestClientBlocker`; this is deliberately not represented as a passing
end-to-end cancellation qualification. No allocation followed this finding.

Box ID/state/expiry and stop receipt: not applicable; zero boxes allocated.
