# Redline composed startup barrier repair — 2026-11-09

The actual Redline controller now launches through a supported, one-shot host
barrier. It boots an unselected document, authenticates the current CPU's private
compile record, requests the registered Redline launch, and authenticates the
parked owning Worker's live bytecode before permitting original PE loading,
DLL initialization or CPU execution. It issues **no app-bearing original
`Page.navigate`**. The recovered old caller fails this admission regression;
the repaired actual composed caller passes against the same inert transports.

This is an offline implementation and regression result. No Chrome, original
game, native input, runtime box or actual Worker was started. Native lifetime
remains REVOKED; all-writer coverage and edict ABA remain UNKNOWN. Vehicle entry,
driving and native strafe qualification remain unverified. No original retry is
authorized by this repair.

Evidence: `scratch/runs/20261109-redline-startup-barrier-repair-0700/`.
The preceding diagnosis is
[`redline-side-door-route-0642-20261109.md`](redline-side-door-route-0642-20261109.md).

## Implementation and ordering

`tools/redline-browser-run.cjs` is the tracked implementation of the retained
`20261108-redline-car-door-native/browser-run.cjs`; the retained entry point now
delegates to it. It preserves the existing capture/admission chain, strict
18-field identity, selected-module checks, ordinary input helpers, reviewed
scene checks, held-owner polling, ACK and sticky UNKNOWN behavior. Its existing
generated/preflight branches remain separate; they cannot qualify Redline.

For an original Redline launch the URL contains no `app` parameter. After the
neutral shell is ready, `tools/redline-startup.cjs` installs
`lib/redline-startup-admission.js` and calls `WineAssembly.getWasmModule()`.
Installation rejects an existing compile promise or conflicting Quake II/Drakan
module provider. It sets neither game's observation flags. The actual host
artifact and source compilation paths both use the installed admission service.
The service privately copies the exact byte view before any await, hashes it,
compiles precisely that copy, and retains the resulting native Module identity.
There is no public buffer/Module pair whose claimed relationship is trusted.

Only SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
2,185,596 bytes, is admitted. Old f965 records do not admit these bytes. An armed
artifact failure is terminal, rather than falling back to another source.
Explicit source compilation still has the existing source-layout check and
the same exact-byte admission. Cold compilation is required; late opt-in fails.

The caller then requests the ordinary `shell.launchApp('redline_demo')`.
`WineAssembly.init()` latches the installed service before its first await.
Immediately after the normal `_maybeStartGuestWorker()` returns, init parks
before returning to browser-shell's `loadExe`, `loadDlls` and `run` sequence.
It requires an isolated slot-0 Worker; cooperative fallback cannot admit an
original. The gate pins the host instance, memory, selected Module, GuestThreadHost,
WorkerLink, actual Worker object and endpoint. Both host and link must carry
that privately compiled Module. The existing production Worker receives that
Module; no substitute observer or native custody provider was changed.

While init is parked, the caller finds exactly one live Worker with that
endpoint/slot, requires exactly one parsed module, reads its bytecode through
`Debugger.getScriptSource`, independently hashes and sizes it, rereads the Worker
instance identity, and rechecks the parked host owner. A matching one-use token
releases init; init revalidates its owner upon resumption. Refusal rejects the
park, awaits existing `_stopGuestRuntime()` retirement, preserves retirement
failure separately, and joins launch settlement before the controller's normal
terminal browser close. It never releases or requests another original launch.

The startup deadline is at most 18,500 ms and remains inside the existing
20,000 ms CDP ceiling. The barrier has its own observable refusal status and
deadline timer. Existing 30-minute controller deadline, immutable runtime cap,
5,000 ms helper hold ceiling, 24-count relative-motion bound, 120,000 ms scene
freshness, work ACK/held checks and no-replay rules are preserved. The ordinary
shutdown path and native custody policies are unchanged.

## Executed regression and checks

`node tools/redline-startup.test.cjs` executes the entire recovered old controller
and entire tracked new controller with an inert filesystem/process/WebSocket/CDP
transport, an isolated page realm, and inert Worker bootstrap/retirement. It runs
the actual production host compile, init and `_maybeStartGuestWorker` methods.
Native WebAssembly compilation uses the selected a320 bytes; instance setup and
guest-entry markers are inert. No actual Worker or guest instruction runs.

The old controller's actual navigation prefix reaches app-bearing navigation
with zero live-bytecode reads and zero new-document flag installations. It
enters the inert original without admission (**old FAIL**). The new controller
authenticates the private compile before launch request, reads the owning
Worker bytecode while init is parked, then reaches one inert original entry
(**new PASS**). There is no original app-bearing navigation.

Fifteen negative compositions verify zero original entry: wrong compile bytes,
wrong live bytes, absent bytecode, wrong endpoint, owner race, foreign Module,
Worker startup failure, detached Worker, retirement failure, multiple parsed
modules, wrong slot, changed provider flag, missing Worker, late opt-in and
conflicting provider. Each created inert Worker is retired exactly once and its
retirement settles before browser close. Retirement failure is retained as a
failure, never described as successful native drain. Additional controls cover
source compilation, deadline expiry, wrong release token, replaced owner,
reused release and a mutated caller buffer with a nonzero-offset private snapshot.

The retained owner/module/freshness/exact-ACK/sticky-UNKNOWN guard tests,
relative-input rejection tests and actual tracked capture/readiness test pass
with new artifacts written only in this task's run. The locked full build
passes. The host's callback census records this narrow opt-in await/retirement
review; broader ownership remains pending. Test waits and separate stream EOF
records are retained; command logs are gzip streams from their first byte.

## Recovery and remaining native limits

Git is the source archive. The run records its exact Git base, the small relevant
binary diff including new tracked files, and small recipe/input patches. Retained
accepted proofs are independently referenced by SHA and size without copying
their media or modules. No source tree, source/media archive or duplicate binary
is stored. `/home` remained above the 1.5 GB floor; no RAM gate was used.

Future recovery uses the tracked caller and helper, with `REDLINE_RUN` pointing
at the prepared run. Refresh the complete closure rather than replaying the old
f965 manifest. The caller requires exactly one verified pin for `host.js`,
`tools/redline-browser-run.cjs`, `tools/redline-startup.cjs`, and
`lib/redline-startup-admission.js`, as well as the exact selected CPU. The old
manifest is intentionally insufficient. The retained readiness test now reads
the tracked controller; its capture function is unchanged.

These tests establish implemented composition and fail-closed ordering. They
do not qualify browser debugger behavior, Worker scheduling/retirement in Chrome,
OS process lineage, native input/consumption, uninterrupted owner continuity,
or gameplay for the changed providers. Any separately authorized native attempt
still requires all native lineage, runtime ownership/release, watchdog, immutable
deadline and input-fixture gates. No unchanged failed original is retried here.

This task's box ID is null; state NOT_CREATED; expiry null; stop receipt null.
There was no box create/resume/delete, original input, public deployment, Codex
worker or agent launch. The single task ends after publishing and releasing its
files.
