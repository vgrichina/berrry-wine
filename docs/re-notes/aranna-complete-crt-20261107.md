# Aranna: CRT staged, browser admission interrupted by provider failure

Run `scratch/runs/20261107-aranna-complete-crt/` stopped at a runtime setup /
transport boundary. No generated guest and no Aranna original were launched.
There is no new emulator defect, semantic fix, registration result, menu or
world evidence.

The existing `binaries/dlls/msvcrt.dll` was added to the retained runtime's
2,190-entry input manifest and uploaded to its supported registry location.
`lib/dll-registry.js` already resolves `msvcrt.dll` there. A remote read verifies
278,581 bytes and SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`
(`terminal-boundary.json`). This is a dependency staging correction, not a
production source change. Authentic guest and media bytes remain unchanged.
Full closure preflight did **not** pass: Expansion.dsres staging was interrupted
with only 40 of 55 parts present remotely. Neither successful browser CRT loading
nor demangling is established by the DLL's presence.

A generated PE and browser harness were prepared, but not executed. They are
intended to exercise ordinary LoadLibraryA/GetProcAddress, native CRT __unDName,
and the original unchanged dbghelp UnDecorateSymbolName lazy CRT path, checking
exact full-signature and name-only output. Only fixture generation and JavaScript
syntax checks ran. Prior CLI CPU semantic controls were not repeated. No new
registration tracing or CPU hypothesis was attempted.

## First new boundary

Chrome prerequisite installation/launch passed with Chrome 151.0.7922.108. The
initial 1001×800 shell capture (`smoke-before.png`) was personally inspected:
empty teal desktop, Start button, no guest. A single request to persist a
balanced Start click timed out after 35 seconds. It was not replayed. Subsequent
file-transfer URL creation, execution and box inspection returned HTTP 500;
parallel media transfers also timed out. `first-error.json`, the three
`boat-api-failure-*.json` files, `smoke-balanced-input-remote-attempt.json`,
`smoke-after-manifest-remote-result.json` and `restore-media-parts.log` retain
these outcomes. The input request has no successful transport receipt.

Read-only recovery later succeeded. Command history contains no accepted smoke
input command; the filesystem contains no smoke-action.json or smoke-after.png.
The recovered browser state reports apps=[] and no pointer lock. The personally
inspected recovery capture (`recovery-terminal.png`) shows the same empty shell
and closed Start menu. Reconnection used Puppeteer's default 800×600 viewport,
so this is not a matching-viewport before/after input comparison. Balanced input
smoke is **unproved**, and neither generated-browser nor original admission was
allowed. Provider failure is the run's harness boundary; these observations do
not identify an emulator divergence. Actual guest renderer/provider/module are
unavailable because there was no guest. The shell's WebGL selection is not
renderer evidence; browser command-line SwiftShader flags are not a measured
provider result.

## Recovery and shutdown

One fresh persisted UUID Idempotency-Key created `bx_73mty888` at
07:09:36Z, originally expiring 07:39:36.712Z. No resume, second box, original
input, public deployment or source/media archive was used.

All unique prerequisite/shell/recovery captures and logs were retrieved and
hash-verified in `smoke-before-manifest.json`, `final-recovery-manifest.json`
and `all-processes-manifest.json`. The exact existing browser received normal
Browser.close. Its waiting shell process remained after SIGTERM, then exited
on SIGINT; no second browser or input was launched. All 12 recorded processes,
both ports, the profile and all four runtime/build locks are clear
(`cleanup-verified.json`, `all-processes-clear.json`). After unique evidence
recovery, the explicitly delegated normal box stop completed nonforced at
07:18:49.676Z. Terminal state is archived, stopped 07:18:49.659Z, expiry null.

Source identity: initial checkout SHA is in `checkout-sha.txt`; relevant tracked
hunks are in `runtime-dirty.patch`, the existing untracked boot helper is in
`untracked-wininit.patch`, and owned small run inputs are in `owned-inputs.patch`.
The retained runtime identifies its source revision and every expected input in
`runtime-pins.json`; `pin-source-corrections.json` records the immutable Git
revision used for changed metadata. An inherited compressed WASM input was
read in memory and checked against its existing hash. Earlier staging attempts
halted on a missing compressed input, changed metadata, and a changing owned
fixture hash; no full-closure success is claimed. Source payloads were removed
from staging transport records, preserving command/input hashes and recovery
paths (`source-payload-removal.json`); Git remains the source archive. Media is
referenced by its existing path and SHA-256 in `media-parts-manifest.json`.

No production build was required for this documentation-only publication.
Next: a fresh bounded task after provider stability, complete closure preflight,
executed browser demangling control and personally inspected balanced input
smoke, then one original scene at a time with fresh reviews and checked ACKs.
Do not reuse this stopped box or infer a CPU defect from this interrupted setup.
