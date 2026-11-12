# Heretic II crate load: observed GL error and context boundary — 2026-11-12

Fresh current04 SoftwareGL loaded the exact whole-four `crate0400`, showed an
upright saved crate-recess world at HUD health 31, completed fresh backward
movement, and remained upright through a separate released interval. Fresh
WebGL again called native `ExitProcess(8)` during normal loading. **The new
permitted GL observations do not identify a runtime violation explaining that
decision. No production patch or new save was made.**

Run: `scratch/runs/20261112-heretic2-runtime-boundary-1910/`.
Authoritative recovery remains parent
`20261112-heretic2-current-paired-crate-onward-1110/RECOVERY.md` and
`20261112-heretic2-current-load-exit-cause-1135/RECOVERY.md`.
All four preferred originals remain together under
`20261112-heretic2-north-opening-health-crate-0400/save-inputs/crate0400/`:
server.ssv 2,752 B, game.ssv 62,728 B, demodocks.sav 1,395,332 B,
demodocks.sv2 90,112 B. `crate-manifest.json` retains their exact hashes.
Neither the separate living 0237/0136 fallbacks nor failed auxiliary sets were
substituted or changed.

Runtime source stayed frozen at `8a834a3dc7affc8c6e53245beab56e87a32b81e8`;
actual guest and owning renderer modules in both arms were
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Checkout entry was `c458e7c5105f13a6a343567114f218eec6220a86`.
Original registered media and unchanged qualified helpers were reused by SHA.
The final 2,423-file closure, changed observers, shared-memory forwarding tests,
return/exception identity tests, observer-fault isolation, 22-field null/change
refusals and normal-load-only console schema all passed before box allocation.
Actual provisioning joined 0 with both EOFs and verified 2,425 pins, including
manifest/deadline, before either original browser started. The final frozen-file
check also passed. Later helper files perform only terminal inspection,
recovery, lifecycle accounting and evidence checks; the runtime observer was
not edited after allocation.

The new renderer observer forwards original calls once. It records existing
WebGL `getError()` results without issuing an additional error query, bridge
`glGetError` results, context creation/current transitions, frontend error
transitions, exceptions and context-loss events. Presentations are sampled
every 60 calls; this is not an exhaustive presentation-return trace. Its
native-import wrapper produced no direct GL-query return records. That absence
is consistent with the actual runtime contract: the WAT encoder submits bounded
streams through `gpu_gl_call(0x10001, offset, length)`; ordinary direct GL
opcodes are rejected by `lib/guest-rpc.js`. The renderer replay records supply
the actual observed GL-query results. The synthetic forwarding tests alone are
not evidence of guest-visible query writeback.

Both arms created context 1 and made it current successfully, with no later
observed context switch/deletion before the exit or ordinary closure. Each arm
made one bridge `glGetError` query, returning 0 at startup. WebGL's six existing
native WebGL `getError()` reads also all returned 0 at startup. **Every observed
error query predates the save mount; neither arm queried the backend error flag
during normal checkpoint loading.** There were no recorded frontend error
transitions, context-loss/restoration events, renderer-call exceptions or
observer errors. This does not establish that an unqueried backend error flag
was clear during loading, nor explain the native exit.

Actual ownership comes from GL endpoint 1, live context objects, renderer target
and epoch, recovered modules, completed presentation and full screenshots.
SoftwareGL has `software:true`/`backendSoftware:true`; its separate legacy
WebGL endpoint is irrelevant to that identity. WebGL has both flags false,
WebGL 1.0, and the actual reported Mesa/Intel renderer string. No physical GPU
claim follows from that string. All 30 full captures retain stable, non-null
22-field bindings before/after capture and before admitted input. The internal
phase label remains `startup`; actual GL ownership and all identity fields were
verified directly, without treating that label as gameplay qualification.

Each browser followed native Main → Game → Easy, reached original upright docks
with HUD, mounted the exact four-file manifest, verified whole-file VFS hashes,
and visibly reviewed/submitted only `load crate0400`. SoftwareGL's completed
saved-world, fresh-backward and released-survival PNGs establish its living
control. WebGL's fresh-start rat reduced HUD 100 → 98 → 92 before console entry;
those captures are preserved, with no health write or claim of identical
pre-load gameplay timing. The loaded save bytes, media and runtime closure were
identical across arms.

WebGL's API-tail timestamp places native exit 8 at **19:33:03.672Z**; the host
console received it at **19:33:03.727Z**. The proposed console-close command
started its admission reads while the guest was still loading, then received
`Session with given id not found` at **19:33:03.728Z**. There is no admission or
pulse receipt for that command, and the last dispatched input remains the
normal-load Enter release. Its retained operation exited 1; nothing was
replayed. Chrome closed 0, and the runtime parent actually joined 1 with both
EOFs. SoftwareGL's runtime parent joined 0 with both EOFs. The familiar final
API-tail successes, save coverage and optional model misses are not new causes.

The **first remaining permitted witness is the final completed owning-GL
presentation retained before teardown**, bound to the native exit notification.
The final API tail records `wglSwapBuffers` returning 1 at 19:33:03.667Z, five
milliseconds before the exit call. The last full PNG is the earlier black
loading/console frame. A late CDP screenshot cannot recover a retired renderer.
A future prequalified observer should retain the latest completed compositor/
GL presentation pixels and recover that frame on native exit, without changing
guest calls or interpreting private guest structures. It might preserve visible
native diagnostic output; this run does not claim that such output exists or
that the final frame explains the exit. Do not repeat startup error reads or
the closed save/model/API-tail findings as a cause or a fix.

`check-evidence.py` verifies 364 remote references / 276 unique raw hashes,
encoded/raw hashes and sizes, 30 PNG bindings, exact save mounts, stable full
22-field identities, GL observations, balanced trusted keyboard edges
(SoftwareGL 56, WebGL 38), runtime-parent waits, profile cleanup and normal stop.
`compressed-evidence-manifest.json` and `retrieval-verified.json` recover each
original. Git SHA, relevant binary diffs and owned-helper patches recover
source; no source/media archive was made. No guest reverse engineering,
disassembly, extraction, patching, substitute DLL, forced guest call, config/
clock/state write, onward qualification, new checkpoint, FPS/audio/parity or
full-corpus claim is made.

Own private box **`bx_uh4ghfzm`** had an independently observed two-hour watchdog
before creation and initial expiry **21:13:51.567Z**. Unique evidence was
recovered and hash-verified before normal stop at **19:35:42.087Z**.
Final state is **archived**, expiry null; receipt **`stop_efe142b2325cc57b`**
completed unforced, error null. The fresh stop subprocess actually joined 0
with both EOFs. The original local manager exec ended 143 without its parent
wait file; the watchdog survived reparented, observed the completed stop, and
exited. Original manager/watchdog parent waits remain **UNKNOWN**. Both browser
parents' actual waits are retained separately. Shared disk-floor dips held
launch during provisioning; actions resumed above 1.5 GB. No reserve change,
RAM gate, additional worker or public deployment occurred.
