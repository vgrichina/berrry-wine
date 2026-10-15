# Original CMR3 replay after line-list support

Prepared source only; no game has run on this module yet. Runtime requires a
fresh root grant after the current Kkrieger owner releases `bx_9ef2wdsw`.
Recheck its 13:03 UTC expiry before staging: allow staging, the full 590-second
controller bound, evidence transfer and cleanup. Do not start with insufficient
time. Use the Boat exec API, never SSH.

`tools/cmr3-lines-gameplay-stage.js` creates the previously nonexistent
`/home/user/cmr3-lines-gameplay`, detached at
`78a06540f49dec6a8061354b5b3baf08d27be55b`. It verifies the clean tested donor
`/home/user/cmr3-software-lines` at `750bc13fd`, rejects differences outside
the explicitly named non-build files/docs, and compares actual bytes for all
other tracked files. Only then does it copy the regular 1,803,537-byte canonical
module SHA-256 `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
It verifies package manifests before sharing the existing dependency directory.
It does not start a guest or rebuild. Capture its stdout as staging evidence.

Run the controller `tools/cmr3-lines-gameplay.js` from an external script path
so the pinned checkout remains clean. It uses a fresh
`scratch/runs/20261015-cmr3-lines-gameplay` under the new checkout, validates
the exact 302 originals, twelve native dependencies, 972-entry registry and
316,640-byte generated profile, then performs actual PNG encode/decode before
guest spawn. Source, module and fixture identities are recorded before/after.
The controller retains the established 540-second guest/590-second outer bounds.

Use `node tools/ctl.js -s :8137 png OUTPUT` and ordinary keydown/keyup controls
only after inspecting each current screenshot. The earlier run's Escape then
Return route is guidance, not a batch replay oracle. Try Stages once it is
visibly selected; attempt driving controls only if a race becomes visible.
On a checked renderer failure, retain the first error, current frame and full
log, then request harness quit. Record actual executed input batches from the
log. No guest memory writes, forced transitions or fake dependencies are allowed.

Capture sanitized process PID/PPID/comm before and after, with no command-line
arguments or signed URLs. Stop only the owned child/controller. Terminal zero
establishes cleanup, not gameplay. Transfer all meaningful receipts/logs/images
to the shared repository's matching `scratch/runs/` directory, verify artifact
hashes, and inspect screenshots before publishing investigation metadata last.
There is no matching corpus ID, so do not attach a result to another game.
Do not claim browser rendering, audio, logical FPS or driving from menu video.

Preparation checks: both scripts pass `node --check`; `git diff --check` passes.
Actual staging, fixture verification, PNG preflight and gameplay remain unrun.
