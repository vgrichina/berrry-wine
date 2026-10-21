# Browser evidence recovery

Use exact `0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb`. Full staged source and
dependencies remain in `/home/user/madbomber-browser/repo` on `bx_j693sabt`.
Coordinator owns this running box and its shutdown; expiry 19:06:34.564Z.
No additional execution is authorized by this recipe.

The task branch preserves all selected evidence as ordinary files; no archive
extraction is required. Run `python3 -B verify.py` from this run directory in
a checkout containing the exact-base Git object. It checks all sealed bytes
and source identities. Inspect the original PNGs under `evidence/browser*`
for visual claims. `evidence/delivery.json` identifies the 14-image selection.

For an authorized later replay, restore the original archive named and hashed
in `preflight.json` to `test/binaries/candidates/madbomber/`, preserving
`original/` and `dependencies/`. Restore the other 27 pins from their recorded
paths. Keep the durable local original archive intact. Restore the module
from the accepted Army provenance path or the accepted Mad Bomber CLI archive
per `docs/re-notes/madbomber-current-main-gameplay-20261021.md`. Verify canonical
source equivalence for the actual revision before reuse; do not rebuild if
identity holds. Verify every asset/module hash before launch.

Install exact lockfile dependencies with `PUPPETEER_SKIP_DOWNLOAD=1 npm ci
--omit=optional`. `identity.py before` verifies the staged Git blobs, assets,
module and dependency inventory. `browser.js` and `browser2.js` are the exact
capture scripts, with remote paths explicit. Each starts a localhost-only
server and headed Chrome and reads sequential ordinary DOM-input commands
from `evidence/browser[2]/commands/`. The preserved command files contain the
actual paths and timing plans. Use fresh output directories to avoid replaying
old commands unintentionally. Both scripts close their browser/server after
the 60-second window; postflight separately checks PIDs/port and file identities.

Full additional captures remain in the remote 17,791,642-byte archive, hash
`5520cb4ee85c9b61f76600bb8c259e6a0d03320add0d66da97746d10daa4b8bd`.
Only the reviewed 14-image selection is needed for the accepted findings and
is committed. Console/network/errors, timestamps and input records are all
included in the committed selection, not merely summary counts.
