Renderer physical modifier ownership repair, 2026-10-26

Commit: 67b01162d74016f0f9f9915e1b07d7a81f942770
Branch: task/renderer-physical-modifier-state-repair-oct26
Accepted immutable base: 9148ceb18768955f647130c2e936228429892477
This is an accepted ancestor, not a claim of current main. Coordinator-reported
remote main b06ab7a2c7f30c3b67555ff11cdab1dbd3d5eef9 needs separate integration.
Only lib/renderer-input.js and test/renderer-physical-modifiers.test.cjs changed.

Recover source/tests from remote branch with dedicated trusted SSH settings:
GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
Do not replace trust controls. ls-remote.txt records exact verified remote SHA.
The local sparse repository relies read-only on the donor flat object leaves:
/tmp/render-elision-independent-integrate-oct26/ops/flat
Its base is a shallow boundary, avoiding unrelated history acquisition.
recovered-objects.json and recovered-blobs.json identify focused local recovery.
Baseline source is retained byte-exact in baseline-renderer-input.js; SHA-256
4ea9ba14249a361b6c498c8e019cc27b761bc080af755eab04616b85af5ca051.
repair.patch is supplementary recovery; the remote Git branch is authoritative.

From the isolated repo, bounded commands:
timeout 25s node --max-old-space-size=192 --require ../ops/baseline-loader.cjs --test --test-reporter=tap test/renderer-physical-modifiers.test.cjs
Expected baseline exit 1: 36 failing / 1 passing, baseline-final.tap.
timeout 25s node --max-old-space-size=192 --test --test-reporter=tap test/renderer-physical-modifiers.test.cjs
Expected repair exit 0: 37 passing, repair-final.tap.
timeout 25s node --max-old-space-size=192 ../ops/run-legacy.cjs
Expected exit 0: existing pinned test/test-keyboard-message-lparam.js,
retained unchanged as legacy-keyboard-message-lparam.cjs, legacy-result.txt.
The loader changes only module resolution for the retained original source;
assertions invoke installed renderer methods, not an independent model.

Ownership lives alongside the physical map. Code/location select left/right;
repeat does not add owners. Numeric release clears all owners through existing
handleKeyUp/pokeKeyDownState routes; map replacement drops ownership. Numeric
injection retains async previous-state fallback. Modifier release events retain
a snapshot for takeInput's message timeline, independent from physical polling.
Alt tap toggles menu only at the final release; Ctrl+Alt, Alt context bits and
F10 message family regressions pass. No browser listener or guest code changed.

Incidents: initial broad instruction/search captures exceeded the 8192-byte
excerpt target; subsequent reads narrowed. Sparse checkout warned about missing
unrelated parent blobs: recovered only 20 loose blobs (16352 bytes) read-only
from immutable donor, no broad fetch/history. Initial repaired run 34/35 failed
an overly specific inactive-menu undefined assertion; boolean correction and
first logs retained. Final baseline and repair use identical final tests.

resources-*.json retain measured task/launcher/session bytes, a single
conservative charge of current shared WAL bytes, future growth and 8MiB reserve.
Installed Node and donor objects are standing read-only inputs. No full compile,
large wasm arena, guest, runtime, box, deploy, service restart or main mutation.
No gameplay claim. No assigned box; shutdown ownership stays with coordinator.
Remaining gates: coordinator review and reconciliation/integration with main.
