# Original Uplink: fresh upper-deck Load through elevator to earned bay save

Run: `scratch/runs/20261112-halflife-upperdeck-onward-1535/`.

The complete1510 upper-deck successor is now **qualified in a fresh browser**.
Normal Load of UPLINK01:30 restored the scientist/guard control deck, followed by
fresh right strafe. Onward native play reached the elevator, activated its
interior control, passed LOADING, arrived at the distinct red-lit crate bay,
and moved out of the elevator. Health100 / armour0 persisted. Native Save →
complete export → move away → normal Load → fresh right strafe then qualified a
new bay checkpoint **in this browser**. Fresh-browser restoration of the new
bay export remains untested.

## Starting checkpoint and actual owner

Before allocation/browser startup, the authoritative1510 gzip was independently
verified against SHA256
`127dc22406ec82235fc489d4573a971915eeaa81c8e572cac4bc8fb38b4ebd1c`.
All five complete files and their ordinary required mounts matched their
recorded sizes/hashes,483845 bytes total. `checkpoint-independent-verification.json`
and `restore-mounts.json` retain that check. The original export remains
unchanged. Its [1510 handoff](halflife-stable-load-onward-20261112.md),
[1430 chamber checkpoint](halflife-earned-cross-session-save-20261112.md), and
[paired1220 route](halflife-current-paired-onward-20261112.md) remain separate.
No opening or closed input stream was replayed.

The fresh Chrome profile used original media and ordinary native video menus:
OpenGL / Default /640×480. The exact580-file staged closure and import-only gate
passed remotely before Chrome; the browser independently read and verified the
five mounted VFS files before Load. The native list initially highlighted00:45;
`u11-successor` explicitly selected01:30 before `u12-nativeload`.

The actual emitted1510 caller and strict capture helper are byte-identical.
After the native Load click's DOWN/UP acknowledgements, `postLoadReady:true`
passively observed the actual renderer Worker/GL endpoint/context before its
first screenshot: endpoint1, HWND65564, SoftwareGL, stable818ms. It sent no
additional guest input or forced guest/GL call. `u14-settled`/`u15-bound` show the
saved NPC deck; `u16-freshmove` visibly moves the wall monitors and guard left.
Fresh document epochs and guest/renderer targets differ from1510.

Both actual guest and owning renderer bytecodes hash to
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Actual bridge `software:true` establishes SoftwareGL independently of the page
dropdown. All22 postbinding identity fields remain unchanged through the
elevator map transition and successor Load; within-screenshot identity equality,
full-frame/hash/age checks, native DOWN/UP and terminal no-replay rules remain
strict. No rebind or weakened capture policy was used.

## Onward consequence and continuity

`u18-console-facing` shows the scientist behind the console. The player traverses
the upper balcony toward LOADING BAY ACCESS / HANGAR16. The elevator opens in
`u25-aim-call` **before any Use pulse**; no Use attribution is made for that door.
`u26-enter-elevator`/`u27-elevator-inside` enter it normally.

Earlier E and Tab pulses produced no established departure. The original pinned
default.cfg was read without edits and binds Tab; the earlier1220 native Controls
screen reported E. Native movement and mouse input adjusted range and aim.
`u52-use-control`, a new E1000ms pulse at the changed position, visibly lights the
arrow amber and closes the doors. `u53-elevator-travel` shows LOADING; the arrow
subsequently changes to down. `u58-travel-settle` shows the opened doorway and
distinct red crate bay. `u59-onward-bay` advances out toward the small crate and
large wooden loading structure. A later arrival E produced no separate claimed
effect; the doors opened after further passive waiting.

`u64-native-save`/`u65-export` show Saved beside the close crate. `u66-move-away`
backs toward the elevator, with the crate visibly distant. The native list in
`u69-loadgame` highlights the newest UPLINK00:20 above01:30 and00:45. The ordinary
Load/current-game confirmation is `u70-loadselect`/`u71-loadconfirm`, again using
passive actual-owner readiness. `u73-restored-settled` returns to the close crate;
`u74-restored-move` visibly strafes right, moving that crate to the far left.
Health100 / armour0 persists. The new map's native entry displays00:20.

## Complete bay export and recovery

Authoritative emitted artifact:
`recovered/webgl/earned-native-save-u65-export.json.gz`,323911 bytes, SHA256
`f02a6513218da738ba3f6301962992e287fdf85d25e14991b08655aea939c715`.
`successor-save-manifest.json` records all nine complete files,997089 bytes total,
including both map auxiliary sets and all three native slots:

| Filename under `c:\valve\save\` | Bytes | SHA256 |
| --- | ---: | --- |
| `half-life-000.sav` |164727|`7df87bd87c7e0b46f5bad250407bd13c6d8cf6fab2e0e0e82521f3ccbf54b346`|
| `half-life-001.sav` |162244|`33bacf5f3d8724350b564a47820140c5a5a4e8c835cb8a5bd2c5d8e81130596e`|
| `hldemo1.hl1` |152996|`b7ad47aa61694b5ea63ab0dc534f9c8f7fcdcb75d7c71ccee8197eb169451f36`|
| `hldemo1.hl2` |1356|`3965080e291b0dd65cfb7d362049957b06d1096fd88d3d9e0a7d119332bc0f87`|
| `hldemo1.hl3` |12|`3a15095d9c483691698b4a2017a7a45f94cbd3436577f0ad698acd58ef62653c`|
| `hldemo2.hl1` |175774|`c0aed0c9bc6bbe5a3513fd14486d1c5c5a515c84921a5d1218637fabbbf0d165`|
| `hldemo2.hl2` |1836|`5d461add8587ece4ece543965caa721cec61b39617a8a380352666f629a5591f`|
| `hldemo2.hl3` |4|`df3f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81119`|
| `half-life-002.sav` |338140|`bd2f47ff728603d2363d30a1cb236b042b3be43e332c027f1b1553bb07fff981`|

`successor-recovery.py` verifies the entire gzip, strict base64, path set and all
file hashes. `--prepare` creates ordinary required mounts while refusing to
overwrite existing bytes; `successor-restored-save/` and
`successor-restore-mounts.json` are already prepared and rechecked. Restore all
nine together, select UPLINK00:20 / `half-life-002.sav` through native Load in a
fresh browser, establish a new owner chain and verify fresh movement before
continuing beyond the bay. Earlier saved slot bytes remain identical, but map
auxiliaries belong to this complete new set; do not mix exports.

## Verification and shutdown

Frozen source commit: `fbcb8a1c0fb62a2bb42948a80679f9916ac331d0`.
`relevant-source.patch`, `relevant-untracked-source.patch`, `fixture-source.patch`,
and initial/final helper patches preserve relevant dirty/runtime/helper inputs.
Git remains the source archive; no source-tree/media archive was created.
Original65-file media pins passed. No guest console/config/AI/health/position/
clock writes, forced guest exports, workers or public deployment were used.

Unchanged capture/binding/release/save/API1…600/retained21-second ACK/no-replay,
102 emitted key/wait forms and actual emitted readiness transition results are
hash-pinned and reused. All shared staged production pins are unchanged from1510;
both readiness fixture revisions exactly match its recorded source patch.
Fresh exact staged-import positive/missing-dependency controls and original-media
checks passed. The complete successor recovery, all nine prepared mount hashes
and overwrite refusal passed. No production code changed; no new build is claimed.

`postflight.json` verifies830 recovered references,75 full frames,60 postbinding
captures with22 strict fields,145 trusted native events and62 balanced acknowledged
pulses (21 clicks,41 keys). Own observations were packed incrementally with exact
round-trip hashes. Minimum sampled `/home` free space was1515511808 bytes, above
the1.5GB floor; no RAM gate was used.

The private independent two-hour watchdog was observable before allocation.
Chrome exited0/signalnull; the actual outer parent waited0 with both EOFs.
Kernel custody reaped362/362 owned processes with none remaining/unreaped and
complete command EOF. Unique evidence was retrieved and hash-verified before
delegated normal stop. Manager/watchdog actual parent waits are0 with both EOFs.

Box **`bx_kmwx23wp`** is **archived**, stopped **2026-11-12T15:52:24.223Z**,
expiry **null** (initial **17:33:57.138Z**). Receipt
**`stop_68f24d5056756605`** completed15:52:24.242Z, forcedfalse, errornull.
No box was deleted, resumed or left billing idle. This bounded SoftwareGL result
adds no new parity, full27, FPS, audio or combat claim. Prior WebGL bay evidence
remains accepted separately.
