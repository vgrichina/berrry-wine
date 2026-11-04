# Deus Ex owned publication attempt: staging failure and rejected restored capture

**No pulse was sent. The first browser staging failure was an omitted pinned
`src/api_table.json`; the later valid world PNG also failed the conservative
publication gate.** This attempt does not establish the cause of the earlier
zero motion or blank world. No production code changed.

Evidence: `scratch/runs/20261104-deusex-owned-publication-pulse/`. The executable
Node driver is `feasible-evidence/driver.cjs`, generated using published
`479b341a6`'s `prepare-driver.py` repair function from the exact retained
feasible-region driver. Both new helpers were staged directly under
`feasible-evidence/`, preserving its original observer, movement observer,
hold helper, native paths and save manifest. Only the driver deadline and
pre-browser module HTTP verification were added to that executable repair.

## First failures, including the staging limitation

The initial Node process failed to resolve `puppeteer-core` before starting
HTTP or Chrome. Its complete log is `recovered/driver-first-dependency-failure.log`.
The attempted command1 never passed the startup ACK guard and was never
published. The retained predecessor's `remote-preflight.py` explicitly provides
an npm-install fallback; that fallback resolved Puppeteer 25.16.0. The package
lock and installation log are retained. Dependency resolution and all helper
syntax passed before the sole browser launch. Starting the first Node process
before checking this dependency was a provisioning oversight.

A second provisioning oversight remained: minimal staging excluded `src/` and
`tools/`, omitting `src/api_table.json`, although its exact bytes were verified
locally among the 453 pins. The HTTP handler returned 500 at
04:20:18.245Z and the host logged API-table parse failure at .250Z. This was
found during the closed-run recovery audit, after the commands below. I did
not enforce stop at this earlier server failure while the browser was active.
The server log and `first-live-staging-failure.json` preserve it without
reclassification as an optional404. The historical host consumes this table
for ordinal import mapping; its absence must remain a competing startup
limitation even though this attempt displayed the restored world.

The owned staging helper now includes the exact historical API table and
checks its HTTP response before Chrome. The launch helper now requires that
pin and validates staged bytes and Puppeteer before spawning Node. Actual
launch-preflight negative tests reject both original omissions before driver
spawn. These repairs were tested offline only: no second browser, reload or
corrected runtime attempt occurred. The recovered tested driver remains the
original executed bytes. The repaired staging recipe is not a claim of a
successful complete provisioning rerun.

## Single original restore and observed boundary

One browser ran Chrome 151.0.7922.108 with the predecessor's SwiftShader flags
and 1024×768 viewport, from 04:20:17.811Z until cleanup 04:21:39.086Z
(81.275 seconds). I personally viewed each PNG in a separate completed tool call
before its next dependent command: startup logo, Load dialog showing Save
Count 14, then restored crate room with ceiling lamp, crosshair and HUD.
The commands were startup capture; Escape/Down/Enter to Load; one Enter to
restore; owning actor observer installation and restored capture; quit only.
Down was menu selection only. All four terminal ACKs matched, maximum 6 steps,
with no held keys. Ten trusted DOM events balance; eight keyboard dequeue
records cover the four menu/load presses. No gameplay key was delivered.

The restored screenshot was bracketed by these observations:

| Boundary | Before | After |
| --- | --- | --- |
| Time |04:21:25.368Z|04:21:25.458Z|
| Owner |hwnd65539/process1000|same|
| DOM presentation |screen and screen-present connected/visible, matching renderer|same|
| Owning Worker |slot0/tid1|actor sample from same selected Worker|
| Completed publication |735 at 04:21:25.362Z|736 at 04:21:25.389Z|
| Owning published surface |visible648×488 with back canvas|same|
| GDI/layer sequence in publication |1795/1796|1797/1798|
| Worker publication held |true|true|
| Pending flags |held|held, scheduled, deferred, DX dirty, shared dirty, frame due|
| Shared DX dirty/locks |960/1|962/1|

Qualification is exactly `pending/held publication; screenshot not a settled
frame`. Publication also crossed the screenshot (735→736), independently
violating the unchanged-publication requirement. The owner and completed
publication were present; the missing boundary was a settled publication
interval around this capture. A visually valid busy frame was conservatively
rejected. No approval command, timing extension, repaint, retry or pulse
followed. The valid PNG does not override its failed boundary.

Actor brackets at 04:21:25.366Z/.459Z both identify JCDentonMale0,
ptr272119808, Physics1, yaw250640, location
`[7026.70458984375,-1707.887939453125,109.60284423828125]`, velocity0,
height43. The original save cross-check passed. The independent movement/Base
reflection observer was not installed because publication qualification had
already failed; live BaseSmall0/support readiness is therefore unmeasured,
not claimed passed. Original native guard code is unchanged. Left bitmap
history contains only `down:false`; no Left queue events exist. Renderer poll
counts reflect page publication work and do not establish Worker-local key
queries or engine consumption. No motion-response experiment occurred.

## Identity, validation and handoff

All 453 historical manifest entries were recovered and hash/size verified
locally from the exact Git recipe, existing media paths and immutable
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`.
Historical source is Git `a504fa248caaecbbb042b65e9ae5384a340ade26`
plus the nine-file `20261104-deusex-supported-stack/historical-source.patch`,
SHA256 `9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
A temporary Git index supplied historical blobs without modifying the shared
checkout. No current-main substitution, source archive, save/config/binding
edit, media evidence copy, or module rebuild occurred. The six relevant JS
contracts match the historical pins.322 staged runtime/helper files verified
remotely before Chrome and unchanged after closure; this count excludes the
omitted API table and unused WAT/build tools, and does not mean all 453 were
staged. `local-pins.json` and `staged-pins.json` distinguish those sets.

Actual pre-Chrome HTTP module bytes were 1,898,260 bytes, SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
The same module was recovered after closure. Companion module ABSENT.
Tests before Chrome:33 boundary cases, actual generated and staged capture/
approval integration (fresh accepts; stale/pending/missing owner rejects),
six queue cases,14 timing/readiness cases, and syntax. Final tests additionally
exercise repaired launch rejection for both staging omissions. No production
build was needed for run-only helpers and this note.

After quit, recovery verified Chrome10721 and driver10713 absent, private
port8123 closed, cleanup completed and all 322 staged pins unchanged.
All 45 unique run/helper files plus the actual module were recovered with full
SHA256 before 04:36Z. Git SHA, relevant binary diff and owned new-file patches
are retained; Git remains the source archive.

Assigned box `bx_affrncy3` was healthok/hydratedtrue/APIidle, with actual exec
RUNNING ACK before use. Final info and exec at 04:22:03Z confirm the same state;
expiry is 2026-11-04T04:46:29.292Z. It remains RUNNING under coordinator ownership.
No lifecycle action or access to another box occurred. Work ends here; no
successor or further gameplay is authorized by this result. The first staging
failure and busy/crossed restored publication are concrete observations;
stale presentation, wrong viewport/actor relation, genuine guest/render failure
and missed short-pulse engine consumption remain unresolved for the old run.
