# AVP2 current browser attempt, 7 November 2026

The original fixture and registered browser manifest are restored. Current
browser gameplay remains **unverified**: the single admitted original route
stopped during required-file loading on a recorded Chromium cancellation. No
gameplay inputs, scene captures, guest configuration changes, or emulator repair
were made. The accepted October gameplay and fixed HUD/DXT diagnoses are unchanged.

Evidence: `scratch/runs/20261107-avp2-current-browser/` (ignored).

## Fixture recovery and registration

All 18 cabinet files were recovered from the retained
`scratch/runs/20261018-avp2-local-launch/handoff/`. Case-insensitive original
names were mapped to the spelling in
`test/candidate-corpus/avp2-demo-files.json`; gzip streams were decompressed,
and existing uncompressed files were hardlinked. Every recovered size and
SHA-256 matches that inventory. `tools/verify-avp2-recovery.js` passed locally
and remotely. The fixture is now at
`test/binaries/candidates/avp2-demo/game/`.

The existing `writeBrowserManifest` function in
`tools/fetch-candidate-corpus.js` wrote the ignored candidate-root manifest
using the corpus's actual AVP2 browser definition. Its 17 companions exclude
the original launcher executable and contain no command-file override.
`test/test-candidate-browser-manifest.js` passed. The retained 136-byte
`handoff/avp2cmds.txt` was neither edited nor copied into the fixture; its
before/after SHA-256 is
`48d472700862291e96bdb7e1ce2311b91778b38d5cfebf6f8de6fd3ab411b76a`.
Original `autoexec.cfg` and `Profiles/Default.prf` passed the cabinet hashes;
no settings were synthesized. No new generated child command was recovered.

Recovery is reproducible without an archive: for each inventory path, read its
lowercase retained handoff path, or its `.gz` stream if the plain file is
absent; verify the inventory size/hash before writing the original-case path
under `game/`; run the verifier, then the existing manifest writer. The run's
`fixture-audit.json` records every exact source path, compression state and
verified original hash. `registered-manifest.json` preserves the small generated
manifest; it does not duplicate game media.

## Tested source and bounded environment

Source commit: `57139b29b3c5be175e012c50a4a7c1964ab7347c`.
`source-diff.patch` records relevant uncommitted runtime hunks, including the
already-present untracked `lib/wininit-boot.js`. No source tree was archived.
Selected runtime, media, fonts, native DLLs and module inputs were pinned and
verified at their actual remote paths: 606 files, zero terminal mismatches.
The ignored `binaries` link resolves to `test/binaries` locally and remotely.
Chunk transfer used temporary remote pieces and verified complete assembled
files before admission. Game media remains referenced by fixture path and hash.

The served standard module was
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes); its exact bytes are retained as `tested-wine-assembly.wasm`.
The original-route console reports guest Worker slot0 instantiated with 2288
exports and 294 brokered imports, but the actual instantiated module bytecode
receipt was not persisted before the collector failed. Consequently the served
module identity is verified; independent instantiated-module identity is unknown.

One UUID-idempotent fresh box: `bx_z4d6hnmp`, AMD Ryzen 7 9700X, four reported
cores, Chrome151.0.7922.108, isolated threaded page,
1024x768 viewport, requested WebGL. No rendering endpoint was created, so actual
renderer/backend/GPU-provider identity is unavailable and no GPU rendering claim
is made. The 35-minute box deadline was 08:45:12.045Z, with input admission
closing six minutes earlier and runtime cleanup four minutes earlier.

Two setup mistakes were retained explicitly. Supplementary files initially
uploaded beneath a duplicated absolute prefix; assembly failed at its first
read with no assembly/runtime effects. Correct intended-path uploads then
passed all preflight hashes. Next, the dropdown-based harness closed before
guest admission because AVP2 has no dropdown option. `index.html` explicitly
supports registry IDs outside the dropdown through `?app=ID`; the first and
only original route used that documented direct link in the same box.
The earlier selector attempt had no launch-input receipt, no guest host, and
normal browser exit0; its artifacts are retained under `prelaunch-selector`.
Neither mistake was treated as a guest failure or used to justify an original
runtime retry.

## Exact new blocker

At 08:12:42.123Z, static-server request163 completed HTTP200 for
`test/binaries/candidates/avp2-demo/game/AVP2.exe`: 57,344 bytes,
SHA-256 `36a772c2340ea7e415d8213d92b7a18d9541ef07c53b028d8a8ec475caf79b7d`.
At .124Z the owning page's response-stage collector captured and verified the
same body, then recorded `continued`. Chromium subsequently reported
`Network.loadingFailed`, `canceled:true`, `net::ERR_ABORTED` for the same
network ID `7496.264`. This became the first sticky collector fault.

The boot capture calls `bodies.drain()` before writing a screenshot. Its drain
threw at `tools/browser-response-body-collector.cjs:341`, so there is no boot
PNG or reviewed screenshot. At 08:13:01.889Z the terminal state was
`running:false`, guest Worker present, `main:null`, no children, no render
endpoints, and status **Loading data files 9/17**. The runtime closed at
08:13:02.634Z with browser exit0, no signal and empty held-input set. A later
read-only screenshot attempt found the already-closed CDP port; it did not
relaunch or send input. Detached driver OS wait status is unknown; the driver
error and terminal output are retained separately.

The actionable next step is a generated-only reproduction of this exact
captured/verified/continued required-HTTP200 cancellation, with an independent
consumer completion witness, before another original session. Retained server
and collector logs distinguish complete correct server bytes from the client
abort. They do not establish why Chromium canceled the request, that AVP2's
launcher executed, or an emulator instruction/API defect. Do not bypass the
fault, replay the guest, fabricate a callback, or revive the fixed HUD/DXT work
on this evidence. There is no semantics-based source repair to commit here.

## Tests, evidence and cleanup

Original18 verification passed twice; manifest regression passed; the run-local
bounded-input controls passed delayed keydown/UNKNOWN finally-release and
serialized-success checks. No emulator source changed, so no new locked-build
or emulator-regression claim is made. Ordinary Marine menus, static geometry,
causal movement and fire were not reached. No FPS, audio, device, parity or
full-corpus claim follows.

Thirty-five unique remote artifacts (1,778,272 bytes), plus the terminal audit,
were retrieved and individually size/hash checked before stopping. The audit
verifies 28 tracked PID/start identities absent, four ports refused, profile
and singleton locks absent, zero input events and zero queued input. Both
prelaunch and original harness terminal records refer to the same reused
profile pathname, which is absent. Physical/async key maps are null because
no guest renderer input owner was established; this is not a fabricated key
release receipt.

Delegated nonforced stop completed at **08:14:52.934Z**; box state **archived**,
expiry null, no resume/delete. Lifecycle was under five minutes. Local free
disk remained above 2GB (2.85GB at final check). The restored ignored fixture
and retained historical gzip sources remain intact. Result metadata is written
last, after note publication and artifact verification.
