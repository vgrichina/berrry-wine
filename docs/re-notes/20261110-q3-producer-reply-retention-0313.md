# Q3 producer replies and startup console retention

Evidence: `scratch/runs/20261110-q3-producer-reply-retention-0313/`.
This task was entirely offline. No box, browser, original-game execution,
native retry, guest-state edit, tier override or deadline change occurred.
Shared renderer, startup and CRT providers were read-only.

The 0250 evidence still establishes only that the producer selector refused
readiness. Its 22 original producer reply values were never retained and
cannot be recovered by this change. There is no supported causal runtime fix.

`createReadinessDiagnostics` now recognizes the exact authenticated
`producer-ready.cjs` READ expression at the generated caller's existing request
boundary. At existing delivery, before original settlement, it retains the
already parsed result or protocol error, request ID, request/response session,
target, expression hash, monotonic receipt time, pending status and explicit
session-match flag. It preserves returned endpoint, backend, owner, current
context/window, completed/presented/write counts, WebGL draws/vertices and
software/control fields when they fit. It adds no protocol work or evaluation.
Mismatched sessions remain visible; recording does not authenticate or reroute
them. CDP and JavaScript exceptions keep their original behavior.

The lane remains disabled unless `Q3_READINESS_WIRE=1`. It reserves at most
64 producer replies independently of other wire records. Each result/error
copy permits 1,024 nodes, depth 12, 128 members per container, 2,048 characters
per string and 16,384 total key/value characters. Loss is explicit through
`truncated`; the 64th reply carries `recordLimitReached`. No unbounded stringify
or full-payload clone is used. Sink failures do not replace delivery.

The existing observation module adds a separate, default-off console flag.
When enabled, its existing CALL seam invokes JavaScript only for original
routine `0x443840`. It records the CALL's target, caller return address, ESP,
first cdecl argument pointer and up to 2,048 original bytes as Latin-1 text,
with termination/truncation status. Reads use the bounded direct window only;
they never invoke g2w, service a fault or write guest memory. Read errors retain
caller metadata. At 64 records the WAT flag is disabled, preventing further
console callbacks. There is no new clock or polling loop. Menu observation
retains its existing independent binding and limits.

Set `Q3_STARTUP_CONSOLE=1` **during preparation** with the existing explicit
menu-consumption, bound-input, checkpoint, foreign-closure and native-lifecycle
options. The sealed `passive-menu.json` then contains `startupConsole:true`;
the emitted original Worker installer arms the console observer immediately
after actual instantiation, before readiness. The generated original runtime
also sets `Q3_READINESS_WIRE=1`. Without that preparation flag, startup console
capture remains off. Reprepare after source changes; do not reuse a stale seal.
The opt-in preparation control used inert small Python inputs that expressly
refuse native transport; its generated caller must not be used as a native
launch recipe.

Static original evidence is retained in `console-disassembly.txt`,
`console-callers.txt` and `original-exe.sha256`. The in-place EXE hash remains
`2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`.
The entry disassembly confirms the first cdecl argument is the input text;
the sampled `0x443898` is inside its normalization loop. Three direct CALLs
at `0x43fe0c`, `0x43fe16`, `0x43fea5` have return addresses `0x43fe11`,
`0x43fe1b`, `0x43feaa`. These are static candidates, not observed original
callers. Other indirect callers remain possible. No media was copied.

Validation passed:

- Readiness controls execute the actual emitted send/evaluate/delivery code
  with controlled replies: complete value retention and request/session/target
  correlation, explicit session mismatch, default inertness, sink failure,
  original exceptions, large-reply truncation and both 64-record limits.
  Existing four distinct pending conditions and advancing success still pass;
  the actual GL adapter/stream/bridge/Worker setup-only control stays pending.
- Menu controls execute the emitted Worker installer, original host init,
  installed instance checks and real compiled observation module. Synthetic
  x86 CALLs naturally produce exact console text/caller receipts before menu
  binding; default-off runs and observed runs agree on EAX/ESP and tier guard.
  Long text, read/sink errors and WAT cap shutdown pass. These fixtures do not
  execute the original game. The actual original startup route separately
  verifies opt-in prearming and retains first-failure refusal behavior.
- Existing Q3 input-observer and readiness-wire controls pass, including the
  entire sealed generated caller with delayed/error/missing replies, its real
  unchanged 20-second CDP timer and no later protocol/input/capture/quit.
  Chrome is replaced with a Node stand-in, and no browser is launched.
- Full opt-in preparation seals 950 providers and prearms both lanes in the
  emitted original runtime. An earlier incomplete preparation correctly refused
  a missing explicitly owned caller input; the corrected control passes.
- `flock /tmp/wine-build.lock bash tools/build.sh` passes; canonical CPU module
  remains `4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.

The next diagnostic requires separate native authorization. Use a fresh sealed
original route with the opt-in above, the existing unchanged startup bound and
owning cancellation protocol. Recover `execution-boundary-transport.jsonl.gz`
(the readiness `producer-reply` and `startup-console` rows), original
`runtime/console.jsonl`, the request trace and passive page/slice evidence.
Join each producer row by request ID and request/response session to its actual
renderer target and page owner; apply the unchanged production selector to the
retained values and corresponding app/backend. Inspect the rejected predicate,
then join the guest console session and caller return address to the retained
text. An incomplete/truncated reply, exhausted console cap, read error or absent
entry remains UNKNOWN; absence alone proves no guest failure or missing frame.
Do not add a post-failure evaluate, screenshot, replay, deadline extension or
guest write. Nothing in this task authorizes that native run.

Git is the source archive: base SHA, owned binary diff/new-file patch and
artifact hashes are retained beside the logs. No source tree was archived.
No box was created or operated, so there is no new box ID, expiry or stop
receipt. Inherited `bx_tc9bkdf5` remains archived, expiry null, with prior stop
`stop_976d2cb9fb819771` completed 2026-11-10T02:56:58.406Z; untouched here.
Files are released after publication and this single-task worker stops.
