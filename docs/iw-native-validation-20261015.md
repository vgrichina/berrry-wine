# Exact candidate native validation

Candidate `17e713cd2ceab10b9b31e4d6d6448b120c3fd43f` cannot reuse the historical
canonical module `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
An actual-file audit on bx_9ef2wdsw verified 212 native/compiler/build paths
against donor `750bc13fd07a59dfed1e49b19533a561ffea1208`; the candidate changes
`src/09a5-handlers-window.wat` by adding the foreign-process synchronous
SendMessage yield-10 path. Both donor module copies are physical 1,803,537-byte
files with the historical SHA. The audit JSON retains this distinction.

After the root's explicit sole-lane grant and independent Jedi postflight /
process inventory verification, prepare a fresh shared clone from
`/home/user/cmr3-software-lines` at `/home/user/wa-iw-native-validation` on that
box, fetch the exact candidate SHA from origin, and detach at that SHA. Link
the donor's node_modules; do not copy or link its build directory. Copy this
controller separately to `/home/user/iw-native-validation.py`. No source edits
or donor module writes are permitted.

Run through the documented Boat exec API, detached:

```
/home/user/.ascii/boat exec bx_9ef2wdsw --detach -- python3 /home/user/iw-native-validation.py --root /home/user/wa-iw-native-validation --out /home/user/iw-native-validation-evidence --grant root-after-Jedi132450-release-20261015T1344Z
```

The controller runs all `tools/build.sh` gates with a 600-second bound; requires
a new physical module inside the fresh build directory; and records its SHA,
size, exact source hashes, engine version, stage exit statuses and logs. First
native test is `WA_TEST_WASM=<new canonical> node test/test-scoped-dll-native.js`
with 90 seconds and one 512 MiB shared memory. Same-module and concurrent-map
tests consume the same physical build path; lifecycle races, Worker message,
import graph and terminal tests receive WA_TEST_WASM. Each suite is serial.
Process-send runtime deliberately recompiles source with a test-only export
and uses two independent 512 MiB memories; this extra compile is explicitly
authorized by the root for this slot and is never represented as canonical.

The 1,200-second overall admission budget reserves each stage's full bound
before starting it. Build is 600 seconds, scoped/readiness/mapping/races/Worker/
imports are each 90, terminal and process-send each 180. Actual early completion
can admit all stages; exhausted budget leaves later stages untested. First
failure stops the suite. Inherited process markers detect and remove stage
descendants, including separately detached children; any needed cleanup fails
the stage. Full tracked source snapshots and postflight survivors are retained.
Canonical module SHA is checked after every native suite. Do not infer scoped
two-owner race coverage or original Invisible War compatibility from these
ordinary-loader tests.

Source checks passed: Python syntax, real inherited-marker process discovery
and cleanup, source-byte mutation detection and exact restoration. No Wasm or
guest execution was involved in those controller checks. Local sparse checkout
keeps available disk above 2 GiB. Remote has 41 GiB free; the existing expiration
14:21:55 UTC exceeds the granted slot starting about 13:45 UTC.

## Executed result

Full gated build passed on Node v24.18.1, producing a new physical canonical
module of 1,803,670 bytes with SHA-256
`a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48`.
The initial controller PID 136851 ran for 26.44 seconds. Scoped native x86
attach/FreeLibrary/detach/generation receipts, same-module concurrent readiness,
concurrent mapping and lifecycle races passed. The next Worker-message fixture
failed in VM bootstrap: its deliberately no-op importScripts harness supplied
DllLoader and processBoot but omitted the newly required ThreadSendWaits.
This failure occurred before its native assertions.

Commit `469572b2bc1a8114c7a43dd9e606b3ce7b978d34` supplies that production
constructor in the sandbox without changing any assertions. A source smoke
evaluated the exact sandbox literal against the full production Worker:
bootstrap passed, deleting the dependency reproduced the exact constructor
error, and restoring it passed. Root reviewed the one-property patch.

The resumed controller PID 138843 reused the canonical module after checking
every original tracked file except the approved fixture and proving the native
and compiler diff empty. It preserved the original overall deadline. Worker
message lifecycle, import graph lifecycle, terminal lifecycle in cooperative
and Worker modes, and process-send native runtime all passed. The latter
compiled its explicitly instrumented module separately as intended. Boat
confirmed PID 138843 exited 0 at 13:49:38.516 UTC; elapsed resumed work 5.86 s.

The existing `WA_DLL_STALE_MAP_CONTROL=1` negative control then failed with the
intended delayed-old-mapping generation assertion, exit 1. Clearing the control
passed, exit 0. At 13:51:05.494 UTC independent postflight checked all 6,547
tracked source hashes unchanged, no active validation/build/guest/browser
processes, the new canonical SHA unchanged and donor 937466 unchanged. The lane
was released to the root; no more runtime was requested.

Recovered artifacts in repository `scratch/runs/20261015-iw-native-validation/`:

* `initial-evidence.tar.gz`, 638,590 bytes, SHA-256
  `c31baf373f8d7ffeeed9881c7e03220b23aeaaaca0d54e27906d0f8806ed7c48`.
* `final-evidence.tar.gz`, 1,317,742 bytes, SHA-256
  `aadaa1b213753d8e50b2d22440c922cb2d9a6ae63f7b4df96f47b0782f66b9fc`.
  This includes the exact canonical binary, final source snapshots, stage and
  negative-control logs, postflight, generated real-PE import/terminal fixtures
  and their guest logs. Retained remotely as
  `/home/user/iw-native-final-evidence.tar.gz` on bx_9ef2wdsw.

The archive source snapshots bind actual on-disk bytes, not just git HEAD.
To recover locally, extract both archives into a fresh evidence directory.
To recreate the binary if the ignored archive is unavailable, checkout exact
17e713cd2 and run all `tools/build.sh` gates under a fresh approved build slot;
expect the recorded canonical SHA. The test-only fixture correction leaves
that native build unchanged.

## Remaining combined native endpoint handoff

The native scoped test calls ProcessBoot directly on one instance. The native
same-module/race tests exercise ordinary loader concurrency. The scoped
transport suite uses real Worker/local JavaScript endpoints with a **simulated
native ABI**. None establishes the combination of real x86 DllMain, retained
scoped callback frames and two production Worker owners racing one DLL name.
Original Invisible War remains entirely unqualified by this validation.

A fresh source-only task should add a bounded native endpoint fixture using
`test-thread-send-scoped-loader.js` for transport setup and
`test-scoped-dll-native.js` / `test-dll-lifecycle-real-pe.js` for actual x86 PE
program construction. Load the recorded canonical module from WA_TEST_WASM;
never compile the tiny fixture or replace lifecycle exports. Instantiate with
createHostImports and the generated real import signatures; use GuestThreadHost,
WorkerLink, ThreadManager and guest-worker.js with real per-owner thread slots.
Reuse production callback dispatch and byte resolver wiring rather than invoking
beginScopedLibraryYield directly from the test.

First establish one local and one real Worker callback whose real window
procedure calls LoadLibraryA, whose x86 DllMain increments an attach counter,
and whose FreeLibrary executes detach. Assert native INITIALIZING/LIVE/FREE,
generation-bearing publication, exact callback return/ESP, released mapping
pins and gate depth. Then use two Workers over one 512 MiB shared memory with
independent native instances/owners and deterministic barriers: hold A's lookup
or initializer while B attempts the same name; verify no early LIVE/name
visibility, exactly one mapping/attach and B's eventual same-generation reply.
Do not substitute host scheduling delays for the barriers.

Extend only that focused fixture to delayed lookup plus provider unload,
same-owner nested load/unload, FALSE/trap/terminal initialization, lost
mapping/publication replies and retirement of the exact owning endpoint.
Assertions must retain both frame/epoch identity and native owner/generation
checks. Negative controls should deliberately omit native completion or admit
a stale frame/publication, fail the corresponding observable native assertion,
then restore exact source and pass. Keep buffers, registers, gate/pins and
Worker retirement observable. Fixture execution requires a **new** exclusive
runtime grant with per-case bounds and no survivors. Existing native passes
need not repeat for a fixture-only change after source/module equivalence proof.
