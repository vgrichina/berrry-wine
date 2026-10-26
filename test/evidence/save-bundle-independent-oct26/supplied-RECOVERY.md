Source-only normalized save-bundle collision repair

Base: 9148ceb18768955f647130c2e936228429892477 (accepted immutable ancestor, not current main).
Commit: ef3fdad258660c3b838e0836aff32b3ef4a4f8b3
Remote: git@github.com:vgrichina/wine-assembly.git
Branch: task/save-bundle-normalized-collision-repair-oct26

Recover the two changed paths from the verified remote commit, or apply repair.patch to the pinned base. Other paths remain from that base. Minimal test imports: lib/save-bundle.js, lib/zip-mount.js, lib/filesystem.js, lib/byte-provider.js, lib/mem-utils.js, lib/region-map.generated.js and test/fixtures/make-test-zip.js. No packages/install/guest required.

Test: timeout 35s node --max-old-space-size=192 --test --test-reporter=tap test/save-bundle-normalized-collision.test.cjs
The same test hash ran against original save-bundle.baseline.js: baseline.tap retained 3 failures/2 passes; repair.tap retained 5 passes. collision.zip is the genuine independent-builder, Node-SHA256 manifest ZIP from the first failing assertion. It contains vfs/c/save/A.sav and vfs/c/save/a.sav, no raw-name duplicates, valid CRC/hash payloads. Set SAVE_BUNDLE_REPRO_OUT to retain a newly generated fixture if desired.

Normalization follows save-bundle/vfs-persistence lowercase and slash rules. Member sanitizer already refuses empty, dot, parent, backslash and unsafe components; no new trimming, dot resolution, Unicode normalization or glob expansion. readBundle now uses one canonical guest path for uniqueness, spec.path validation, allow-list and writes; repeated manifest specs are also refused. Hash/state reads remain in-memory before import side effects.

Baseline readBundle accepted the ambiguous hashed ZIP; uppercase imports could instead fail their existing case-sensitive allow-list check. No claim that baseline imported the collision successfully. No full sync/server integration run: network tests excluded. No canonical compilation, runtime or gameplay claim. No test box assigned/accessed; lifecycle remains coordinator-owned.

Incidents: initial combined instructions/source tool reads exceeded 8192-byte excerpt limit; later source reads bounded. Sparse donor working source was absent and recovered directly from pinned Git blob, hashes verified; no donor or root refs edited. GitHub reports repository relocation to berrry-wine; push to configured origin succeeded and exact ref verification passed without trust changes.
