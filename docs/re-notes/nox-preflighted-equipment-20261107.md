# Nox preflight dependency blocker, 2026-11-07

No new original Nox gameplay or equipment evidence was obtained. The first
concrete blocker is a missing transitive command-transport dependency introduced
while preparing this run: `transport.cjs` still requires `./ordinary-keys.cjs`,
but the new run contains only the corrected `ordinary-keys-fixed.cjs`.
The numbered key request fails with `MODULE_NOT_FOUND` before creating a command,
writer lock or native effect. This is a harness error, not a game defect.

Evidence: `scratch/runs/20261107-nox-preflighted-equipment/`.

## Local prelaunch coverage and its limit

The corrected starting points were the previous run's `browser-run-fixed.cjs`
and `ordinary-keys-fixed.cjs`. The exact generated production driver ran in
actual local Chrome 151.0.7922.108 through its final app-selection boundary.
A fixture-only environment branch disabled launch immediately after selecting
`nox_demo` in the real app registry; `runningApps.length` was zero. The same
driver was staged for production, with that flag absent, but never executed
remotely. Both local fixture executions remain separate from original evidence.

The exact inherited invalid-duration `assert.rejects` loop, native typing/name
rejection, simultaneous keys and partial-delivery cleanup passed. The generated
Chromium fixture separately exercised I/Home/Space and left/right buttons through
both actual bound and ordinary helper APIs, trusted balanced events, checked key
bitmap release and independent release during 300 ms diagnostics. Process,
endpoint, Worker, module and epoch replacement refusals, stale captures and
slow-capture refusal passed. The labeled generated canvas was inspected.
Generated clock changes belong only to the fixture; no original guest existed.

The exact production prefix was also evaluated with each of its 765 pinned
files missing and corrupted, and with invalid deadlines. These checks passed,
as did the generator's checked anchors and explicit required-file list. They
verified the declared closure but failed to discover its missing transitive
import. Consequently **the requested complete preallocation qualification was
not achieved**, despite the earlier local PASS receipts. Allocation should
have been withheld. This omission was caught after provisioning and before
launching any remote Chromium or original guest.

`first-concrete-blocker.json` preserves a focused failing-before test of the
actual `transport.request` key path. It confirms `MODULE_NOT_FOUND`, zero command
files, no writer lock and zero dispatch. Auditing the generated fixture also
showed that its broad `assert.rejects` transport checks accepted this wrong
exception. In particular, the UNKNOWN fixture has neither a dispatched command
nor `transport-closed.json`; the late-ACK fixture only has its synthetic ACK.
Their reported `closures.json` PASS does **not** establish sticky UNKNOWN,
late-ACK or next-command refusal. Native partial delivery and release did execute
through `consume`, but its subsequent key-request rejection also hit the missing
module. No assertion or input ownership guard was weakened. The driver and
fixtures are retained unchanged for diagnosis, not qualified as a next launcher.

## Pins and lifecycle

The source commit was `4fc6545340c859ff1bedcc90c5888ffb49405989`; relevant
uncommitted runtime hunks are recorded in `relevant-source.patch`, and owned new
inputs are recorded as patches. No source or media archive was created.
All 125 original files match the retained original manifest: 50,450,550 bytes.
The EXE SHA-256 is
`496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
The standard module was staged and fetched/hashed by the local HTTP resolver:
2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
There is no live-original module, process, Worker or renderer identity to report.
Local Chromium used native 1024 by 712 inner geometry, `defaultViewport:null`,
and no viewport emulation. Fixture identities are not original Nox identities.

One UUID-idempotent box, `bx_dftqa858`, was allocated at 09:44:41 UTC.
The inclusive 35-minute deadline was 10:19:41 UTC; initial archive expiry was
10:24:41.478 UTC. All 765 staged pins matched at terminal inspection. No
remote browser attempt, original guest launch, heavy runtime or input occurred.
No assigned runtime PIDs or ports existed; no Chrome, profile or writer lock
remained. All 12 remote run artifacts (200,423 bytes) were recovered or matched
existing local bytes and SHA-256 verified before the delegated normal stop.
The box is archived, stopped at 09:46:05.245 UTC, expiry null, stop completed
with `forced:false`. It is handed back to the coordinator and must not be
resumed for this task. One terminal disk recheck transiently failed the 2 GB
guard during shared filesystem activity; the immediate measured follow-up was
2,683,056,128 bytes free. This run used 1.6 MB, launched no further runtime,
and removed no peer files. The incident is retained in `disk-incident.json`.

No production code changed. No equipment, pickup/HUD/action consequence,
damage, FPS, audio or parity claim is made. Prior original sessions remain
terminal and untouched. No replacement box or original attempt was launched.

Next work must repair the transport import and add positive numbered key/combo
requests with exact ACKs to the actual Chromium prelaunch fixture. Negative
transport tests must assert the expected error and closure artifact, rather
than any rejection. Verify the full transitive input closure and execute the
complete driver/transport prelaunch path before any separately authorized fresh
allocation. Only then pursue the ordinary reviewed Bunker equipment route;
damage still requires an observed target.
