# Q3 startup readiness: offline diagnosis of retained 0250

Evidence: `scratch/runs/20261110-q3-startup-readiness-cause-0303/`.
Original evidence remains in `scratch/runs/20261110-q3-repaired-initialization-arena-0250/`.
No browser, box, original-game execution, native retry or input was performed. The
50-second original observer limit, clocks, tiers, budgets and guest state
remain unchanged. Shared startup, CRT, renderer, Nox and LBreakout are read-only.

The earlier worker published its report in
`3aa59f79761d37f7059925a2b29c77b71b1deb32`, present in `origin/main`.
That commit changes only the 0250 report. Its runtime used
`befbafc5bfc6364c5dff16914726ff72dcfe364b`, initialization repair `29fff6c1f`
and CRT authority `e7e0312bd`. Q3 implementation paths were clean on recovery.
The launcher's subsequent exit 143 has no retained causal explanation; it
does not undo publication or the completed box stop. Prior `result.json` is
retained despite the missing launcher final response.

The first reproducible missing readiness condition is the composite producer
gate in the actual retained `bound-input.cjs` startup `readLiveImpl`:
`producer.select({a,endpoints:glEndpoints,target:r.targetId,backend})` returns
null. Startup returns a pending sample at that point. It has already matched
the guest instance/module and the owning renderer endpoint. It has yet to
validate the renderer module, take a second complete advancing sample, bind
readiness, or request a screenshot.

This boundary follows from all 22 completed `renderer.producer` requests in
the original 280-request trace. Each is followed by the page observation in
the readiness wait, then another sampling attempt. None proceeds to the
renderer module read. The production selector requires a unique matching
GL endpoint/backend/owner/current window context, completed batches,
presentation and a canvas write, plus completed WebGL draws and vertices.
The actual renderer-read expression enumerates the same observed GL bridges;
a selected current context would also satisfy its nonempty-context check.
The final outstanding request is guest-instance evaluation #280, issued at
02:56:13.935Z. It has no retained exit before owning cancellation at the
independent image bound. All 22 preceding producer queries have actual exits.

Renderer attachment first appears in the retained page observations at
02:55:39.249Z. All 39 observations retain process/guest/document ownership;
endpoint 1 remains attached afterwards. There are **nine saved passive slice
samples ending at sequence 1931**, rather than 1931 saved slices. The last
sample is EIP `0x443898`, without a trap. Slice positions and RPC counters
advance; the evidence does not establish a guest hang.

Static disassembly of the existing original `quake3.exe` places `0x443898`
inside the routine at `0x443840`: it normalizes CR/LF, strips caret color
codes, and caps its output at `0x7fff` bytes before sending edit-control
messages. The imported call target at `0x4b123c` is `USER32!SendMessageA`.
An earlier saved sample is `0x443889` in the same loop. This identifies sampled
console-text work, not the input string, caller, error message or its cost.
The EXE SHA-256 is
`2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`;
the media was referenced in place and never copied.

The decoded console evidence contains 210 distinct render-boundary records
out of sequence 1–828, leaving 618 unretained boundaries. The last full ring
has 64 entries, 764 overwrites, zero recorded boundary/errors, and ends in
completed batch 122. The host ends in that request's completed exit. Observed
commands include context creation/current binding, state, texture operations
and error queries. Diagnostic `hwnd:0` on ordinary opcode markers is a default
marker argument, **not** proof that the actual context lacks a window.
Missing frame markers in these incomplete rings cannot prove no earlier frame.

The new `tools/q3-startup-readiness.test.cjs` verifies the relevant production
source bytes against the 0250 sealed manifest, authenticates and decodes four
unique retained logs, and regenerates the caller with its actual menu, pointer,
cause and wire transforms. It executes the emitted chain initializer and
readiness call through the real observation-instance adapter. Four controlled
conditions—missing presentation, canvas write, draw, or matching owner—each
reproduce the same pending request path and prevent readiness publication.
Complete advancing receipts pass. These controlled values are not original
CDP replies. A separate control executes the real GL adapter, stream, bridge
and actual Worker observer on a software consumer: four setup commands finish
with a valid current window context and zero presentations, correctly pending.
No GPU or original-game readiness claim follows from that control.

The exact original producer reply values were not saved. Consequently these
four candidate explanations cannot be separated from retained metadata.
The precise unresolved boundary is the producer selector's rejected field(s),
then the guest work before a qualifying draw/presentation; guest registers,
console string and command payloads are absent. No causal production repair
is supported. The actionable next evidence is the **existing producer reply
value**, correlated to its request/session, plus console text/caller at this
startup boundary, under a separately authorized run with the existing limit.
This task authorizes no such run.

Validation passed: new offline readiness controls; Q3 menu-consumption controls
including whole generated preflight, real compiled modules, original host
initialization, emitted Worker handler/transport and installed-instance checks;
Q3 input-observer controls; and `flock /tmp/wine-build.lock bash tools/build.sh`.
Only the diagnostic test and this report change. Source identity uses Git and
owned binary diffs/new-file patches, with no source archive.

No box was created. The inherited 0250 box receipt remains
`bx_tc9bkdf5`, UUID `f36453ac-a0f3-45be-85af-0e970ff3698e`, archived,
expiry null, unforced stop `stop_976d2cb9fb819771` completed
2026-11-10T02:56:58.406Z. No operation on that box occurred. Files are released
after publication; this single-task worker stops.
