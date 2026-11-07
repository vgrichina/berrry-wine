# Forsaken driver recovery, 7 November 2026

Local Chromium prerequisites now pass. The one fresh original-game attempt
stopped during provisioning: Boat returned HTTP 500 for upload-URL requests.
No original browser or guest launched, so the reviewed Volcano corridor, death
and respawn from `forsaken-current-webgl-combat-20261107.md` remain the latest
gameplay consequence. This is an infrastructure blocker, not a demonstrated
Forsaken or emulator defect.

Evidence: `scratch/runs/20261107-forsaken-driver-recovery/`.
Candidate: `forsaken-demo`. No production source changed.

## Disk recovery and dependency closure

Lossless gzip recovered **220,077,889 bytes** of closed evidence. The three
receipts are `disk-recovery.json`, `closed-disk-recovery.json` and
`closed-disk-recovery-second.json`. Candidate inventories retain terminal
result times and append-only RELEASE references. Before each original was
unlinked, privileged `/proc` checks found no open descriptor and decompression
matched its original SHA-256 and length. Each compressed file has an adjacent
`.recovery.json` with the original digest, size and exact restoration command.
A third selection made no changes because headroom had already returned.
Aranna and SimGolf runs were excluded throughout; no source/media archive,
unique media deletion, or active-run cleanup occurred. Shared free space
fluctuated: a recovery receipt records 1,926,397,952 → 2,258,112,512 bytes;
subsequent stages and allocation checked the 2,000,000,000-byte floor. Later
shared drops prompted further closed-evidence selection rather than another
runtime stage.

The prior whole-file static scan reached `lib/headless-gl.js` through an unused
helper branch. The executed browser closure does **not** load `@node-3d/glfw`.
No optional graphics package was installed. An import preload hook recorded
successful and failed CommonJS loads, including lazy request imports. All
actually loaded repository paths are pinned; three missing staging inputs
(`ops/browser-native-input.cjs` and the two gltron helper modules) were added
before the final staged execution. The release-control Puppeteer dependency
attempted optional `bufferutil`, then completed successfully using its normal
fallback. That attempted import remains recorded rather than hidden.
`actual-closure.json` and `executed-imports-*.json` preserve the distinction.

## Final staged controls

`qualification-staged/` runs the final driver against generated public-COM
input with the production guest Worker and owning legacy WebGL render Worker.
The actual recovered CPU/render module is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Chrome 151.0.7922.108 reports WebGL 2.0, ANGLE Intel Mesa UHD 620. The inspected
PNG is a generated caption fixture; it is not original gameplay evidence.

The retained failing-before control shows the old awaited-DOWN mouse pattern
delays UP. The repaired pulse arms an independent UP timer before calling or
awaiting DOWN. Fourteen actual Chromium key/mouse normal, delayed/rejected/
pending-DOWN, deadline, rejected/pending-UP cases pass separately, and fourteen
pass with actual production guest/render owners. Unknown cases are isolated
controls and never replayed. Final-driver key and click requests produce exact
ACKs; wrong-ID, pending and rejected ACK controls close transport admission.
Stale review rejects before effects; every exact identity field, actual generated
owner replacement and wrong executing module reject. The final execution
boundary also rejects at the immutable deadline with zero native events and
zero dispatch effects. No guest clock was edited. All three local staged
browsers exit 0; recorded driver/Chrome PIDs, six ports, profiles, writer locks
and held keys/buttons are clear (`local-cleanup.json`).

## One fresh box and concrete remaining blocker

A UUID was persisted before creating **bx_ckvbfva4** at
2026-11-07T11:34:05Z, TTL 2,400 seconds. The browser deadline was fixed before
allocation at **11:59:04.975855Z** and never extended. The 1,490 staged pins
include **873 unchanged original fixture paths**, checked again after the
attempt. Source identity is main
`1f831717cd0dec63265ff0cde43eec4d81c8da9f`, the recorded binary diff and retained
new-file patch for `lib/wininit-boot.js`; Git is the source archive.

Provisioning failed on **nine HTTP 500 upload-URL responses**; only **75/1,490**
files were present. `allocation.log`, `first-error.json`, API failure receipts
and `provisioning-verification.json` retain the exact boundary. All present
files match their pinned hashes. No failed operation, input or allocation was
replayed. One oversized local census invocation failed before spawning Boat;
a smaller read-only census then succeeded. No original launch, browser process,
profile, input writer, held input, driver port or live guest/render module was
created on the box. No guest code/config/save/clock edits or replacement DLLs
occurred.

The remote census was retrieved and SHA-256 verified before the explicitly
delegated normal stop. The box is **archived**, stopped
**2026-11-07T11:35:47.504Z**, stop **completed**, **forced:false**, active expiry
**null**. Its census records no owned runtime PIDs, ports, profile or writer;
input and live modules were never created. No old box was resumed. There is
no running assigned box to hand back.

JavaScript/Python syntax, final staged controls, local lifecycle checks and
873 fixture postchecks pass. No emulator fix, new full build, original gameplay,
FPS, audio or parity claim is made. Next: resolve the demonstrated Boat upload
service failure, then authorize a separate fresh attempt using this qualified
closure; do not resume this archived box. Seek a reviewed new room, intermediate
damage, enemy defeat or native objective through ordinary controls.
