# MCM GPS binding during an observed host call

Evidence: `scratch/runs/20261120-mcm-after-sparse-recovery-actual-quarry/`.

The first fresh original established the actual cause at 15:24:49.480 UTC.
`validateOwner` rejected `hostWrites`: expected no in-flight host call,
actual count 1. All captured guest/link/thread/instance/memory/renderer/process
tokens matched; epoch invalid was 0, active 2, version 509438. The stack was
`gpu_stream_kick` → real GPS endpoint creation → `PreparedGpsObservation.bind`.
The host import wrapper counts that asynchronous kick until its Promise returns.
Requiring it to have returned before binding its own endpoint rejects a valid
observed execution. This is an observed predicate, not an inference from a
combined guard or a fixture.

`prepareD3dimGpsPublicationObservation` retains idle-host validation during
initial writer attachment and after synchronous observer acknowledgment.
Later binding checks every captured owner, participant and unpoisoned epoch
without requiring the observed host call to have returned. Binding still
grants no source-read authority. Writer seals, retained pages, source decoding,
compositing and qualified publication checks remain unchanged. No shared
bridge, render Worker, WAT, input timing or admission-age changes were made.

The production-guard regression fails on the old source and passes on the
repair. It executes the actual preparation method and actual binding lifecycle:
active attachment and arm acknowledgment refuse, observed active binding
reaches ARMED without publication, and replacement/invalid-epoch acknowledgment
refuse. Thirteen predicate controls, diagnostic fault controls and the existing
ten GPS observation tests pass. The full locked build passes. Prior 32 native
and 45 focused controls are reused only against unchanged exact source hashes.

The affected fresh original used the same f5ae CPU/render modules, 183 source
references and 311 existing media inputs. Its actual served host hash records
the repair. Personally reviewed whole 800×600 menus reached PREPARED, then a
fresh rider/bike MENU and Next at (262, 535), within the unchanged 12-second
limit. Quarry rendered with the rider, terrain, HUD and zero speed. The actual
live GPS endpoint, WebGL executor/context and matching CPU/render modules were
verified. This establishes affected-original progress beyond the old failure;
it does not establish qualified synchronous CPU-source publication.

The throttle review then aged out. Admission returned
`STALE_SCENE_BEFORE_DISPATCH` with no throttle DOWN. The finite driver closed
the scope and sent zero later endpoint requests. Throttle, turn, Escape and
ordinary Quit remain unproved; browser termination is cleanup.

The first diagnostic scope has an explicit monitoring limitation: the GPS
exception arrived as a log rather than an error event. One later capture
issued two Runtime.evaluate requests before the isolated-app refusal closed
the scope. It issued zero requests after that UNKNOWN. The affected scope's
run-local listener recognizes that exact fatal GPS host-import log and closes
before further requests. No closed endpoint was reopened or replayed.

Native supervision and finite independent watchers retain actual join/EOF
receipts. All owned runtime processes are nonlive and profiles are removed.
Evidence records exact Git plus relevant binary diffs, owned new-file patches,
media/module references and selected whole screenshots; no source/media copies.
Local box ID null, state NOT_CREATED, expiry null, stop receipt null.
Strict publication outcome is recorded in the run; foreign WIP is preserved.
