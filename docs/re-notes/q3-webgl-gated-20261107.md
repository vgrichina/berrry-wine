# Quake III gated WebGL followthrough — 2026-11-07

This attempt ends before original launch. The sole fresh UUID-idempotent box,
`bx_hxkg62xj`, received all pinned inputs except the registered demo PK3. Its
single PUT timed out while writing. Read-only preflight confirmed that the
PK3 was absent, rather than treating a transfer timeout as success. No transfer
retry, replacement box, original launch, software route, or gameplay input
followed. WebGL world, movement/fire and paired torch views remain unproved.

The absent input is the existing
`test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3`,
46,853,694 bytes, SHA-256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
The other 911 of 912 final runtime pins matched. This is a provisioning boundary,
not a demonstrated emulator or renderer defect; no emulator code changed.

## Run-specific harness controls

Evidence and small run-specific harness inputs are preserved in
`scratch/runs/20261107-q3-webgl-gated/` (ignored). The replacement control records
potentially held keys **before** awaiting keydown and releases them in `finally`.
A serialized gate retains the first failure and rejects later queued commands.
The original driver requires explicit successful provisioning/preflight and
control results. Its primary command path requires reviewed captures and a
successful preceding command receipt; down/up events and released host key
states are checked before another gameplay command can succeed. No auxiliary
CDP gameplay controller is used. That original command path was not exercised
against the game in this run.

The local delayed-keydown timeout regression rejects the old control because
it sends KeyW down but omits KeyW up. The replacement passes timeout and
`UNKNOWN` controls: release occurs, queued Enter never runs and the launch
callback is never invoked. Successful commands also run serially.

The guest-free real-browser control delays trusted Tab keydown, delivers it,
then throws an injected timeout. Its event log contains exactly trusted Tab
keydown and keyup, no Enter, an empty held set, and zero launch calls. This
validates the release/queue contract with actual browser input; it does not
simulate an original game launch. The actual Python transport regression also
rejects missing terminal fields and timeout, and verifies that failed
provisioning blocks launch before any remote invocation. JavaScript receipt
controls and syntax checks pass. No full build was needed for this docs-only
publication and ignored run-harness work.

## Recovery and shutdown

`runtime-pins.json`, `relevant-source.patch` and
`new-lib_wininit-boot.js.patch` record the staged runtime identity and relevant
uncommitted source. Git is the source archive; no source/media archive was made.
`final-harness-pins.json` separately identifies the final local harness, including
additional fail-closed launch guards added after the provisioning failure.
The staged standard module hashes to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
no original owning module, OpenGLHostBridge, WebGLBackend or provider was
instantiated or observed here. The prior menu-only provider observation in
`2661845f9` is not extended by this run.

Nine unique remote control/preflight/log files (313,033 bytes) were recovered
and verified before shutdown. `terminal-cleanup.json` records no browser/Node
runtime process, no Puppeteer profile and no original launch. No original HTTP
listener was started. Remaining machine listeners and available ownership are
recorded in `port-owners.json`; some platform socket owners are unavailable.
The control's exact transient CDP port was not retained, so there is no
individual post-close port probe for it; its browser process is absent.

Normal shutdown was explicitly delegated in the assignment. The single box
reached `archived` at 07:16:26.835Z; its stop completed normally without force
at 07:16:26.855Z, with active expiry cleared. The local messageboard watcher
was stopped and free home space remained above 2 GB. `result.json` is published
last. The next attempt needs a fresh run with reliable
media provisioning before the gated original WebGL launch. There is no new
gameplay, torch, parity, FPS, audio or full-sweep claim.
