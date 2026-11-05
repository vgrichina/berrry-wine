# Lords II lifetime-reviewed far-call diagnostic — 2026-11-05

The diagnostic, lifetime regression and full build pass. The single original
setup observation reached Main Menu, then ended because the worker supplied an
unsupported continuation-queue command before Install.
No installation or gameplay has been established by this continuation.

Evidence: `scratch/runs/20261105-lords2-lifetime-reviewed-diagnostic/`.
The predecessor's note-only commit is `ac64f76395dc86143810e0ff3284e21c7cee00f8`.
Its callback-ownership census failure was an ordinary required repository
lifetime review, not a platform cybersecurity or tool approval rejection.
The census remains enabled; other held investigations remain held.

The diagnostic is confined to the existing indirect Win16 far-call rejection.
It records the effective operand address, target offset/selector, return
address, registers and live selector/module ownership before the far return
frame is pushed. It preserves the existing CS check and guest bytes. Valid
mapped targets and imported thunks produce no fault record.

Each `getImports` context owns its synchronous 21-word collector. Cooperative
imports capture only the collector function, avoiding an extra import-table
memory pin, and run it before their filtered API logger; child exports resolve through
the existing instance-specific context getter. Detached contexts do not replace
the parent context. Completion clears pending words before table/register
readback. Saved records contain scalar copies and do not retain guest memory,
views, instances or callbacks. Capture and console-sink failures are recorded
without replacing the existing CS trap. No await, scheduling change, guest
callback, context restoration, continuation admission or external listener is
introduced. Existing host/import retirement still owns the closure lifetime.

Only the affected `host.js:host-file` census entry was renewed after review;
its broader ownership assertion remains `pending`. The census implementation
and unrelated entries are unchanged.

The generated six-case NE regression covers invalid/null selectors, a DLL
owner, ES displacement/wrap, real internal/import relocations, exact pretrap
operand/return/register ownership, unchanged operand bytes and preserved CS
rejection. The collector lifetime regression drives the production
`init()`-created cooperative factory and interleaves parent and two children.
It checks actual child registers, verbose-off retention, copied tables,
readback/sink exceptions, retired memory and recovery. These generated fixture
results cannot establish original installation or gameplay.

The original observation must verify canonical media in place against all 181
inventory hashes and the existing browser manifest. Git commit plus relevant
binary diff and owned new-file patches are the source recovery recipe. No
source snapshot, repeated media, guest edit, assigned box or subworker is used.

Strong1335 released at 14:17:29 UTC. The coordinator released formats1345 at
14:23:14 UTC after a source-only worker capacity failure; no formats validation
was inferred. Fresh verification found 35 predecessor PIDs absent, 12 closed
ports, four known profiles absent and four free locks, with no heavy runtime.
The current Stronghold profile was separately checked absent before this run.

The new production-factory baseline failed exactly because verbose-disabled
cooperative imports retained no record. The repaired collector lifetime check,
existing census mutation regression, full locked build and six generated NE
cases on each of the standard and compat modules pass. One initial six-case
attempt exposed a fixture error: separate process instances reused shared
memory and its decoded blocks. Each case now uses fresh process memory, matching
browser launches; no emulator behavior was changed for that fixture defect.
Failed and corrected logs are retained.

All 181 canonical media files (14,382,323 bytes) match their inventory hashes.
The existing browser manifest remains
`a1749143a2de176c4f3fdf314337a1767f6101eed4a88b6d5b0dee4d59012f8e`.

## Original observation and remaining blocker

Diagnostic commit `6a0ce7e7198fd023316930471d081a87828ca0af` was published before
the original observation, with explicit pinned-key SSH pull/push verified.
One original launched at 14:30:21.579 UTC with a 540-second outer deadline.
Chrome loaded the standard module, 2,173,124 bytes, SHA-256
`97998535c23a4f6a0f8f982fb5ede1287edc7e2ae8255d5869bdd6fdf33e4e54`.
The saved startup readout confirms the cooperative backend, active child T1,
and no fault record or operand observations. `startup.png` was personally
inspected and shows the Sierra Main Menu. No Install input was delivered.

The worker wrote `commands/0.json` with `click:509,147`. The production
continuation queue accepts `canvasclick`, while `click` is only supported by
the initial scripted-step path. At 14:31:39 UTC the queue rejected it with
`Error: unsupported queued step click` and closed the browser. The probe
exited 1; the passive Chrome observer recorded actual exit 0, signal null,
after ordinary `Browser.close`. This was an avoidable worker input error,
not an emulator diagnosis or platform/tool approval rejection. The caller's
own exit 0 does not override the recorded probe failure.

The original was not relaunched under the one-observation limit. No repaired
original far-call capture, rejected selector, relocated operand, causal repair,
installation or gameplay was established. The earlier Wave-No failure remains
unresolved. The static original-byte lead in `static-operand-relocation.json`
uses the earlier inferred module mapping and is not a live target or proof of
an emulator mismatch. No guest target was changed.

The run now contains a small command writer that calls the actual production
queue validator before publishing a future command. Its regression rejects
the erroneous `click` and accepts ordinary `canvasclick`/wait/fresh screenshot
and quit without launching a browser. A future authorized original observation
must derive click fractions from its current screen geometry, prevalidate each
queue command, then reach Install, System Test Yes and Wave No to collect the
still-missing live evidence. Box ID/state/expiry: N/A; no boxes were assigned.

Cleanup independently confirmed the three own runtime processes absent, the
Chrome profile removed, both server/debug ports refusing connections, four
free locks and no heavy runtime. The first cleanup checker accidentally matched
its own shell command text; that failed checker record is retained and the
corrected check reads actual executable/argument fields from `/proc`. No broad
process killing or cleanup of another worker's files occurred.
