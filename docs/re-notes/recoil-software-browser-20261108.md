# Recoil Software browser source transport repair, 2026-11-08

Run: `scratch/runs/20261108-recoil-software-browser/`.

Completed the **first new tested generic integration repair** alternative:
explicit UTF-8 transport for generated browser source modules and their HTML
entry page. The single authorized local Chrome attempt exposed this defect
in the real `[[FunctionLocation]]` / `Debugger.getScriptSource` path. The
corrected transport has not been retried in Chrome. Software ownership and
its explicit gate remain unvalidated; no gameplay consequence is claimed.

## Real attempt and exact cause

Read the predecessor note at `807e003e2` (the task's concatenated
`recoil-software-owner-20261108.md807e003e2` resolves to that file and commit).
Copied its corrected `browser-integration.cjs`, `local-supervisor.py` and
repaired absent-renderer `bound-input.cjs` into this new run. Independently
verified all 851 provider pins and retained the source/startup/motion closure.
The accepted 28 focused negatives, exact production-copy test, absent-renderer
regression and locked full build were reused by exact log hashes in
`tests-reused.json`; production code was unchanged. Accepted point/custodian
controls were also reused by verified manifest hashes.

Before Chrome, `PREFLIGHT_ONLY=1` passed, all 41 exact generated module wrappers
passed `vm.Script` syntax checks, and the fixture retained
`host.dx_trace(21,7,2,0,0)`. An initial concern about wrapper newline escaping
was disproved by those checks; no wrapper syntax defect is claimed.

Exactly one generated, local Chrome attempt ran. It reached an actual
software copy and passed the independent same-host clock bracket
1794146019781–1794146019783, target1794146019783. The decoder source response
was correctly refused because its hash differed from the pinned UTF-8 source:

- Expected wrapper: `8697e0a455f43c8045bf6d70283f3207bc7207d9cf86fd9a980daa209591164a`.
- Actual Chrome response: `985185d3710e49a9103d70de4ef880c5d6fd8bba052ff3a1d862b6169a9bb9cf`.

The server sent `text/javascript` without an encoding and served an HTML page
without an encoding declaration. Decoding the exact decoder wrapper's UTF-8
bytes as Windows-1252 reproduces Chrome's observed hash **exactly**. This
establishes a concrete transport failure rather than an inferred owner change.
The retained failure and attempted script remain unchanged. The attestor's
parallel lanes drained; no successful source proof was recorded. Response
bodies were not saved by that attempted fixture, so this run does not claim
four complete response artifacts, red pixels verified after those reads, or
actual owner-replacement refusal. Those checks were never reached.

## Tested repair

The successor fixture uses the small run-owned `source-response.cjs` handler:
HTML is served as `text/html; charset=utf-8` and modules as
`text/javascript; charset=utf-8`. Source pins, wrappers, routing and the
existing isolation headers are preserved. No observed hash was substituted
for a pin. The successor also retains every actual source response before
attestation, including refused responses, for diagnosis on a future attempt.

`test-source-response.cjs` executes the exact attempted server handler over
loopback HTTP and reproduces the actual Chrome decoder mismatch. It then
executes the repaired handler over loopback HTTP: all 41 complete responses
carry the explicit charset, decode to their original pinned hashes and pass
syntax checks. It also verifies Unicode HTML, isolation headers, missing-module
404, the successor's use of the tested handler and the corrected type2 call.
`source-response-test.json` records the per-module results. The corrected
41-module preflight passes again. This is actual HTTP transport testing,
not a mock source-response claim or a second Chrome attempt.

The original hardware gate remains unchanged. `gateEligible:false` means
JavaScript ownership does not satisfy its four guest/render WASM contract.
An explicitly named Software counterpart must wait for successful real
browser ownership validation. It must preserve guest WASM identity, actual JS
decoder/compositor owners and hashes/current epochs, drained parallel reads,
final colocated owner/pixels, verified host clock and <=250ms age, changed
timer pair and phase sinks, and sticky UNKNOWN without replay. No observer
bypass, renderer WASM fabrication or contract weakening was introduced here.

## Runtime cleanup and recovery

The supervisor prearmed an observable independent GNU timeout watchdog with
an immutable 25-minute deadline, plus an inner 90-second diagnostic limit,
before allowing Chrome to start. Only the actual runtime held
`/tmp/wine-runtime.lock`. The browser and loopback server closed promptly on
refusal. The subreaper recorded descendant/adopted PID/start identities and
reaped adopted exits. Independent drain checks verify all 23 recorded
identities absent, supervisor/watchdog absent, both loopback ports refusing
connections, no process command line or open descriptor referencing the owned
Chrome profile, and runtime lock free. No native input was dispatched.
Process discovery is sampled at 30ms; the record is not an exhaustive history
of short-lived descendants between samples. No stronger lifecycle claim is
made from that sampling. The surviving-process/profile/port checks found no
residual owned resources.

No new box exists: ID/state/expiry/stop receipt are all N/A. No remote box,
original game, native input, public deployment, old-box resume/delete or
subworker was used. The inherited archived box was untouched.

Recovery records exact checkout SHA in `source-head.txt`, all 851 existing
providers, relevant Git diffs, small owned helper patches and existing media
paths/hashes. No source-tree or media archive was created. Evidence is ignored;
only this note is committed. `artifact-manifest.json` is independently reread
and hashed before publication. Earlier failures remain retained.

Next: in a separately authorized bounded local attempt, run the repaired
UTF-8 successor and obtain four complete uncached JS source responses over
two current-owner reads, actual red pixels, common context/epoch and real
owner-replacement refusal. Only then implement and test the explicit Software
gate. Full27, parity, audio and FPS remain open.
