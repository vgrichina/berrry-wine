# TR2 completed-owning-frame publication pacing — 2026-11-08

**Current pacing remains unresolved. Browser qualification stops at a concrete
production journal-read failure; no original-game run or box was started.**
`SurfaceVersionJournal.read()` passes a shared `Uint8Array.subarray()` to
`TextDecoder.decode()`. Chrome 151 rejects it with `TypeError: The provided
ArrayBufferView value must not be shared`. The observation catches this failure
during ordinary composition and poisons its epoch. A negative/empty Join is not
0 FPS. Logical/simulationFPS, publication pacing and full observer cost remain
unknown.

Evidence is in `scratch/runs/20261108-tr2-qualified-publication-pacing/`.
The tested source is published
`d7c1f187fe4eaaa0fde0879a9684a7c75599526a`, including Join
`663f1c1399fc270d6c29a05ea077742cdc63e299`. `source-audit.json` checks 1,212
published source/tool files against the working tree; all match. The relevant
binary diff is empty. Peer test and operational edits were excluded. Git plus
the retained helper patches preserves source identity; there is no source/media
archive. No emulator rendering divergence was demonstrated or repaired.

The installed Join note/source, retained final protocol/build/publication
results, [default OK activation](tr2-default-ok-activation-20261108.md) and
[frame identity contract](tr2-frame-identity-rate-20261108.md) were reviewed.
The prerequisite really is published and reports its locked build and thirteen
focused passes. Its Node production association regression was rerun here and
passes again: one actual owed publication, five installed-host publications,
eight discard rows, palette/ABA/coalescing/fence/delayed/duplicate/retirement/
timeout controls. These Node results do not establish browser compatibility.
Accepted native Enter, Venice translation and heading were not repeated.

The bounded API admits 1–4096 records, each with a 64 KiB shared slot. Records
are never reused or drained. Reaching the record limit deactivates the producer
observation and poisons its writer epoch. Host arming refuses an existing Join;
retirement does not create a supported same-process rearm path. A future run
must allocate enough capacity for its entire observation and retain raw
records, coverage state and the discard ledger. A failed or incomplete read
cannot silently become an empty successful window.

`worker-join.json` exercises actual production guest and render Node Workers,
the production Encoder, native queued flip/fence, broker, canonical decoder and
raster-canvas compositor. Fixture-only exports expose existing WAT routines;
no game or GPU throughput is involved. All four same-entry queue/fence attempts
complete ordinary pixel swaps, but all four source records are rejected as
`overlapping-or-poisoned-source-writer`. The guest's WorkerLink writer ticket
spans its fence wait, while source sealing requires the render Worker to be the
only writer. This conservatively unsupported execution shape needs separate
integration work; it does not prove every TR2 slice has that shape. The Node
fixture retains four rejected records, four ledger dispositions, zero qualified
rows, zero duplicate completions and capacity 16 without exhaustion.

`browser-fixture.json` uses real browser guest/render Workers and the installed
`WineAssembly.armD3dimPublicationObservation({maxRecords:16})` method in a fixture
host shell. Arming succeeds. The endpoint requests `{api:'legacy',backend:'webgl'}`;
no GPU draw or active-game GL qualification is claimed. Four native queue/fence
completions retain exact owner/request identities and rejection reasons. The
actual canvas alternates red values 17 and 34. Canonical uploads carry the owed
request, but there are no qualified cache/publication rows. The first ordinary
repaint poisons observation; the final direct journal inspection exposes the
shared-view TextDecoder exception at `lib/render-worker.js:298`. The raw four
rejections survive in the producer receipt, while the page discard ledger is
empty because its journal reads fail. That missing accounting is a failed
coverage guard, not evidence of zero dropped/discarded frames. No events were
deduplicated into another timing window.

An isolated browser control (`journal-browser-control.json`) reproduces the
failure with one committed 66-byte journal entry, without Workers or a live
writer. Decoding an ordinary copied byte view returns the exact expected record.
This diagnostic control does not patch the production reader or certify a fix.
Its fetched host and render-worker source hashes match the published blobs.

First source-completion clocks and callback-receipt clocks remain separate in
the raw records/events, including their performance time origins. No qualified
page-publication clock exists in this browser run. No cross-domain subtraction,
publication intervals, three ten-second windows, median/p95 game intervals or
rate is reported. The production records' `qualified:false`/null consumed
version are retained.

Matched import-cost measurements address part of the previously unqualified
default impact. `import-cost.json` retains 132 raw timed trials: eleven
alternating symmetric groups per import, 200,000 actual WASM calls per trial,
with published pre-Join baseline shape (`279ede77e`), new-unarmed and new-armed
arms. Each arm calls the same production `math_sin` or `get_ticks` implementation
in the same JavaScript realm. Median group-paired added costs are approximately
18.2 ns/call unarmed versus baseline and 177.1 ns/call armed versus unarmed for
`math_sin`; corresponding `get_ticks` deltas are 9.1 and 158.0 ns/call. Raw ranges
are wide, including an armed get_ticks outlier above 1 microsecond/call.

These are Node import-wrapper seam costs, not gameplay slowdown. They do not
measure the complete default module facade, arming, journal/source proof,
canonical/page publication, sampler or serialization overhead. No matched
same-living-scene observer/control intervals were reached, so full observer
cost and uninstrumented game performance remain unqualified. The initial
cross-realm benchmark is explicitly invalid and retained separately; its larger
numbers are withdrawn. The first Node fixture failure was a missing Node
Encoder dependency; its error is preserved, and the corrected fixture preloads
the unchanged production dependency as the browser normally does.

The next production work is a browser-safe immutable journal read, with a real
browser regression and measured copy/decode cost, followed by qualification of
the guest-fence writer boundary without weakening coverage. Repeat full
identity/cost qualification before allocating the one watched original. Ordinary
rendering must remain intact and raw rejected/discarded/dropped/coalesced counts
must remain reviewable. This report stops at the integration blocker rather
than treating Node positives as browser acceptance.

Both local fixture Worker owners retire normally. Both local browsers close
normally with Chrome exit 0/signal null and retained target-destruction and
disconnect events; no unexpected original-browser loss occurred because no
original was launched. Local runtimes are serialized with
`flock /tmp/wine-runtime.lock`; available disk remains above 5 GB. No console
input, private input handler, guest/game patch, forced scene, clock/seed/binding
change, deployment, other-agent pane operation or subworker was used.

Box ID/state: **not allocated**. Expiry/stop receipt: **not applicable**. No old
box was resumed, stopped or deleted. The independent deadline/retrieval/normal
stop protocol was not entered. Full27, fullFPS, backend parity and audio remain
open, as does simulationFPS without a separate simulation association.
