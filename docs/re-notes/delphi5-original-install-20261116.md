# Original Delphi 5 evaluation: host transport boundary

2026-11-16. Installation, credential requirements, IDE execution, samples and
normal native Quit remain **unproved**. The documented root `INSTALL.EXE`
executed and created a window titled `Delphi Trial`, then the host desktop
transport failed with `EBUSY` before any input was sent. No screenshot survived
the exception. Window-creation logs do not establish a personally reviewed
visible installer scene or installation success.

Evidence: `scratch/runs/20261116-delphi5-original-trial-install-ide/result.json`.
The coordinator's 09:35:13Z instruction explicitly ended original testing for
this task after the transport repair; no original was launched after that
instruction. The failed endpoint was never rebound or sent input.

## Original route and exact inputs

The complete disc was extracted once to the owned canonical path
`test/binaries/candidates/delphi5-60day-eval/media/`. Its 38 files remain
untouched; no cabinet payload was unpacked and launched separately. The ISO is
81,330,176 bytes, SHA-256
`bcd14e38635f4b3b4c7656f1ce884c26ba60224d7876681a7e3b7382e5c38b0e`.
Recovery and original-media provenance are in [delphi5-evaluation.md](delphi5-evaluation.md).

The CLI mounted the disc as read-only `D:`, started `D:\INSTALL.EXE` with
`D:\` as its working directory, used the default Windows 98 identity and the
real clock, and enabled ordinary process spawning and guest threads. No
serial/password, trial date, expiry code, activation, guest application bytes
or provider implementation was changed. `guest-overlay/` and
`guest-registry.json` were configured below the canonical candidate directory;
neither was written before the host exception. There is no installed state
to resume or export.

The actual runtime used Git commit
`3bcb7bef7e388ff469cdaa7bb297ecc7a76d3bad` and module SHA-256
`ef7de08a1a1ea564ea7ff2fbd1e3dbbd56cbfc07c19d3db7fcb45c9bac4b5fb8`.
Runtime JS/JSON and the module were held in sealed memory descriptors. The
borrowed GTA2 module holder was read-only; this task held and closed its own
descriptor and never stopped that holder. `runtime-inputs.json` records the
individual source hashes. Git plus the recorded helper patch provide source
recovery; there is no source archive or persisted WASM dump.

An earlier host-only preparation failed waiting for desktop authority startup
before guest initialization. Its records are retained in
`startup-prerequisite-v1/`. Narrowing the sealed source view to the runtime
dependency closure removed that preparation failure. This was followed by one
actual root-installer execution; no input gesture was attempted in either
execution.

## Transport cause and repair

The desktop completion function writes `ready=1` and then notifies its caller.
The caller can consume the response and reset the same buffer to `ready=0`
before that notification happens. The next wait then wakes on the preceding
notification. Previously `receive()` treated any notification as completion,
returned the old response, and allowed another request while the bridge was
still handling the current request.

The original trace records `main-return` for poll 7344 before the bridge even
received poll 7344. Poll 7345 then failed with `EBUSY`. A real Node Worker
fixture independently reproduced the stale response before the fix.

`lib/process-desktop.js` now rechecks the ready flag after waking. One monotonic
deadline covers the entire wait, retaining the existing 3000 ms timeout.
Repeated notifications cannot extend it. The focused Worker tests pass for
the current response, repeated unready notifications and sealed source loading
through a real Worker. The existing desktop transport observation regression
also passes, including actual sockets, lost replies, authority death and
terminal no-retry behavior. Its first invocation used a relative preload path
and failed in the test harness; that failure and the corrected absolute-path
run are both retained.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passed with an
actual exit-0 wait. This build qualifies the shared checkout for publication;
its output was never used to rerun the original. The separately recorded
foreign working-tree changes were not included in this worker's commit.

The original also logged COMCTL32 requesting `HeapCreate(0x04000000,1,0)`.
The known `HEAP_SHARED` implementation boundary remains unchanged. There was
no `MakeCriticalSectionGlobal` trap or demonstrated cross-process heap use in
this execution; the first terminal failure was the host transport error.
See [the Sims native boundary](sims-global-critical-section-native-implementation-20261116.md).

## Lifetime and next test

The 1200 s native deadline and independent 1220 s watchdog were armed before
launch, with a 180 s Quit/Cancel reserve. Native PID 3335288 exited 1 after
approximately 12 s including startup; its supervisor actually waited and
closed both output streams. Watchdog PID 3335263 observed that wait and exited
0 without firing. No installer child was created, and no native Quit was
claimed. The owned descriptors, PIDs and port 45651 were closed. No box was
created, so box ID, expiry and stop receipt are inapplicable.

A fresh, separately authorized original test should use the published desktop
repair, capture and personally review the complete launcher scene, then follow
only its ordinary installation UI. It must establish the actual serial/trial
password prompt if one occurs. The prepared controller and later launcher
edits were not exercised on the original and remain uncommitted WIP; they
are not qualification evidence.
