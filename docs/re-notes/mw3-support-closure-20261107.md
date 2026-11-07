# MW3 original launcher support closure — 2026-11-07

The retained staging implementation is repaired. The original production shell
now starts the actual production guest Worker with the generated local PE.
Removing the four known omissions reproduces the authentic signature-404
failure; restoring them boots the Worker and executes ordinary x86 there.
No original MW3 boot, box operation or input occurred in this assignment.

Evidence and executable repair:
`scratch/runs/20261107-mw3-support-closure/`.
`stage.cjs` writes a 245-file support/resource manifest and a **300-file
`repaired-original-pins.json`** compatible with the original individual-file
provisioner. These contain existing-path references, lengths and SHA-256;
they contain no copied checkout or media. The original provisioner was run-only,
so no shared emulator/staging source needed changing.

The four boot-critical staging repairs are:

- `lib/host-import-sigs.generated.json`: required before creating the guest
  Worker and render manager; omission triggered the observed cooperative fallback.
- `src/api_table.json`: production ordinal/name resolution data.
- `lib/vendor/tweetnacl.js`: required by the parser-loaded VLAN module;
  omission reproduced the authentic uncaught page exception.
- `lib/vendor/webaudio-tinysynth.js`: production audio dependency.

The graph also adds `lib/app-icon-manifest.json`, four compiler-stage scripts
and two conservatively retained tooling references. The traversal starts from
the exact current shell script list, production guest/render consumers and
their local file literals, including lazy adapter names. It retains original
font inputs and all 36 original binary paths by reference. The repaired original
manifest preserves all historical driver/server dependencies and the original
33 registry HTTP pins. No existing pinned input drifted. This closure covers
the normal prebuilt-module launch on current Chromium; a browser requiring
source compilation still needs its WAT/include closure and is not qualified here.

`boot-test.cjs` served the unmodified `index.html` and production scripts through
an explicit manifest allowlist. Unstaged resources returned 404 even when they
existed elsewhere in the checkout. It used the original debug/candidates/
no-log/WebGL shell options, without `app=mw3`, then loaded an 8,704-byte generated
PE through ordinary `WineAssembly.init/loadExe`. It used the normal persisted
threads setting, without substituting modules, mocking imports, overriding
module selection, writing runtime guest state or forcing a cooperative route.
The only marker write is an instruction in the generated test EXE itself.

`before/result.json` records `guestWorker:false`, no Worker targets, the original
`worker start failed (sigs HTTP 404)` message, and the TweetNaCl-related exception.
`after/result.json` records `guestWorker:true`, 2,288 exports and 294 brokered
imports. The marker is zero before the production Worker slice and
`0x26071137` afterward. Two live Worker readings agree with the page's process
1000, endpoint 1, slot 0 and shared marker; the page owner is rechecked afterward.
CDP recovered the executing Worker's module bytes twice and matched the exact
staged module: 2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
There were zero post-repair page exceptions or observer errors.

`closure-audit.json` verifies full bodies for 131 executable/support inputs and
all successful browser responses, including actual Worker `importScripts`
requests. It also matches 126 successful authentic original responses against
the current pins. Separate preflight negatives reject each missing required
resource; startup fallback cannot count as a passing result. Remaining browser
404s are explicitly classified: locally absent deploy identity, manifest/icons,
favicon, authenticated service and optional font-bundle optimization. Individual
font delivery succeeds. No missing executable dependency remains in this tested
launch. This does not establish gameplay rendering or runtime API completeness.

Focused commands passed:

```sh
node scratch/runs/20261107-mw3-support-closure/boot-test.cjs
node scratch/runs/20261107-mw3-support-closure/audit.cjs
flock /tmp/wine-build.lock bash tools/build.sh
```

The browser test intentionally refuses to overwrite its before/after evidence.
The locked build passed and retained the same tested module bytes. Source is
recorded by exact Git SHA, relevant binary patches and input hashes, not source
snapshots. The final manifest source SHA is
`e099e0858748db15863710ec7625b683307959c6`; the authentic predecessor was
`d5d4f01d262528c237d3206aa39e592cb959901c`.

Both local Chrome processes exited normally with code 0; servers closed and
temporary profiles were removed. Browser disk monitoring sampled a minimum of
3,660,525,568 available bytes; preparation/finalization samples also exceeded
2 GB. No large writes, media/source archives or lifecycle operations occurred.
Box ID/state/expiry: none; no box ownership to hand back.

For the separately authorized successor original assignment, first OWN a fresh
direct child of `scratch/runs/`, then prepare it without starting anything:

```sh
node scratch/runs/20261107-mw3-support-closure/audit.cjs
node scratch/runs/20261107-mw3-support-closure/prepare-original.cjs scratch/runs/NEW_OWNED_RUN_ID
```

The second command copies only the six small original driver helpers unchanged,
remaps their individual pins, and writes the repaired `runtime-pins.json` into
that new directory. Feed its `files` list to the original individual-file upload
loop (`provision.py`), also upload that new manifest, and SHA/length-verify every
destination before launch. Keep `/binaries` mapped to `test/binaries` exactly as
in the original boot recipe; use cross-origin isolation and no-store responses.
The new driver directory has the same depth as the original, so its root
resolution and helper imports remain valid. Preserve the original immutable
25-minute deadline construction and 2 GB guard. Do not refresh pins silently:
if verification reports drift, rerun this support boot proof in a newly owned
evidence directory before an original attempt.

Then run the unchanged original `browser.cjs` under that separately authorized
deadline. Its production route remains
`/index.html?debug&candidates&no-log&gl-renderer=webgl&app=mw3`. The 18 identity
fields, executing-module checks, freshness, numbered exact ACKs, independent UP
and sticky UNKNOWN gates are unchanged. Genuine application DLLs, media and
configuration are unchanged. Fresh original owning-renderer binding and reviewed
pixels are still required before any native menu input. No prior capture or
this generated-guest proof admits original input.
