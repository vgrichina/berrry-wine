# Q3 current foreign closure integration, 1655

The actual production preparer now accepts four narrowly authenticated published
providers only through `q3-current-foreign-a16fc87d4-44fc9a134-v1`. The old default
and checkpoint routes still refuse foreign drift. No historical manifest,
shared provider, CPU/WAT, host, guest-worker or custody code changed.

Evidence: `scratch/runs/20261109-q3-current-foreign-closure-integration-1655/`.
Git base plus the small owned binary patch reconstructs the change. No source,
media or module archive was made. This work was entirely offline: no box,
browser, local Chrome, native/game execution or original replay was attempted.

## Authority and closure

The historical Q3 pinset contains `lib/quake2-browser-load-observer.js` and
`lib/redline-startup-admission.js`. Reviewed authority is Q2 implementation
`a16fc87d477d8891a741e1a214cfc89f5a924ac4`, published through
`a826c223c0633f19414118033e6f5f8b8651065c`, and Redline
`44fc9a134e0f77bfb3056673326a1475b32f6b9f`. Both final published RELEASE STOP
entries preceded final validation. Fixed independent SHA pins and ancestry in
both HEAD and origin/main authenticate these providers. The new conditional
imports `lib/quake2-current-browser-policy-v1.js` and
`lib/redline-current-startup-v1.js` are authenticated, staged and HTTP-pinned too.
The owning core and other imports were already in the historical closure.

The exact intersection excludes every currently owned Redline1635 publication/
staged-test file and Q21645 launcher/composition/current-module/test file.
Their runtime work was neither frozen nor contacted.

## Explicit production route

Prepare a fresh directory with:

```sh
node tools/q3-current-module.cjs --prepare scratch/runs/OWN_RUN/prepared \
  --foreign-closure-version q3-current-foreign-a16fc87d4-44fc9a134-v1
```

The CLI returns the independent uncompressed manifest SHA and generated caller
path. Pass that SHA from the preparing parent, rather than deriving trust from
a mutable runtime seal:

```sh
node tools/q3-current-foreign-closure-v1.cjs --check-staged \
  scratch/runs/OWN_RUN/prepared q3-current-foreign-a16fc87d4-44fc9a134-v1 SHA
```

`--run-staged` checks the same manifest before requiring the generated caller.
The caller embeds a digest of all other provider pins and imports the versioned
runtime through an exact generated relative path. The runtime verifies every
staged provider before compiling the genuine retained consumer at its original
source path. It never spawns Git. The versioned loader authenticates the unchanged
1625 composition, changes only its one Redline admission hash, and binds the
consumer's manifest read and output to the new run. The old historical manifest
is never substituted at the filesystem read boundary. Runtime output is
`prepared/runtime`; relative helper imports retain their actual source paths.

The existing finite browser deadline and `Q3_EXECUTION_BOUNDARY_OUT` remain
required; `Q3_NATIVE_COMPOSITION` must be absent to prevent a double preload.
The existing outer custody/launch lifecycle remains the responsibility of the
owning launcher. This entry point does not authorize a native attempt. Real
consumer `DRIVER_PREFLIGHT=1` execution and inert source-compilation checks were
used here; no browser was launched.

## Default behavior and preserved boundaries

Accepting the Q2 dispatcher bytes does not select Q2 observation for Q3. With
no Q2 Worker URL selector, the real dispatcher keeps its historical CPU pin and
refuses the current CPU before compilation. An explicit valid selector imports
the staged current policy; wrong selectors refuse. Regression executes those
branches with actual EXE/CPU bytes and WebCrypto, using inert compile/attachment
seams. Q3 sets no Q2 policy selector.

Redline's default admission still selects its legacy CPU and exposes that
legacy identity. Q3's existing admission-source transform replaces the exact
legacy CPU literal with Q3's current `3e491c08` identity, then calls the unchanged
unversioned install branch. Tests check the resulting exported identity and
exercise the real parked startup path. The optional Redline version branch is
not silently enabled. Its conditional dependency is nevertheless staged.

The primary and compatibility CPU identities, physical input admission,
native cancellation checkpoint, WebGL/input ownership checks, 1625 first-abort
behavior, work/ACK/cleanup/runtime/CDP deadlines and screenshot caps are retained.
Offline success does not establish nativeReady, movement/firing, browser EOF,
or the cause of the original screenshot stall.

## Validation

- Actual production preparation CLI and generated relative-import caller pass
  from the current tree, with 934 staged providers. Real consumer preflight
  executes against that current manifest, including a CLI `--run-staged` run.
- Runtime reads are checked against that closure; process/Git effects are
  forbidden in the runtime probe. Real Module compilation uses the genuine
  consumer source path; browser execution is inert or exits at real preflight.
- The existing actual staged-composition regression passes 28 production reads
  and 56 per-read missing/stale refusals with all subprocess effects forbidden.
- Missing/changed foreign providers and conditional imports, both CPU mirrors,
  unrelated drift, wrong versions, forged SHA/size, omitted dependencies and
  manifest repins refuse before compile/launch. Historical/default refusal and
  unchanged composition provider pins are checked.
- Seven deterministic actual command/screenshot clock cases pass with the new
  route and actual current providers. The old comparison alone uses historical
  Git bytes. Nine actual localhost socket/screenshot cases pass with the same
  fixed 20s CDP cap, no pending work/timers and joined sockets/server.
- Whole actual composition/startup controls pass for original and generated
  fixture paths, including old FAIL/new PASS and ownership/module/endpoint/
  slot/flag/deadline refusals. Complete fixture controls pass old FAIL/new PASS
  through ordinary joined quit. These are inert offline controls.

`flock /tmp/wine-build.lock bash tools/build.sh` passed; primary and compat
SHA/size remained exactly `3e491c08`/2186068 and `ecb45716`/2188714.

All completed test groups have observable independent finite watchdogs, actual
child waits, separate stdout/stderr EOF and no remaining process-group members.
Initial harness failures are retained: the optional broad physical suite lacked
its required historical baseline variable; the legacy standalone checkpoint
suite rejected the new admission pin at its unchanged default gate before its
inert runtime could publish. Neither failure is promoted to a native result.

Box ID/state: NOT_CREATED. Expiry and stop receipt: N/A. Inherited and other
workers' boxes were uncontacted. Next is separately authorized use of the new
versioned staging/caller route under the existing owning lifecycle; no native
readiness is inferred here.
