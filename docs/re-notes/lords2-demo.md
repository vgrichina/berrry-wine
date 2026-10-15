# Lords of the Realm II original playable Windows demo

2026-10-15: acquisition and static preparation only. No setup/game execution,
licence answer, gameplay screenshot or qualification. Owner `/root/new_demo_refill`;
task `NEW-GAME-LORDS2-DEMO-20261015`.

Selected after checking current main `8597f6329` registry, corpus, TODOs,
reverse notes and retained board: no previous Lords II lane or qualification.
AVP2 and Silver already have reviewed movement and were excluded from fresh
qualification. Many other registry titles are local candidates, not public
desktop apps; their presence alone does not exclude them. This selection does
not claim that the entire existing candidate pool is blocked.

## Original media and identity

Source: <https://archive.org/details/LordsoftheRealmII_1020>, original package
<https://archive.org/download/LordsoftheRealmII_1020/lorddemo.zip>.
The [catalogue](https://www.dosgamesarchive.com/file/lords-of-the-realm-ii/lorddemo)
also distinguishes the playable Windows demo from the nonplayable `lords2tr`
trailer. Actual package contents, rather than the catalogue label, establish
the chosen format:

- `lorddemo.zip`: 7,522,232 bytes, SHA1
  `6c5ef78db77389da8ec4a0d54a576a0eb0526a48`, SHA256
  `afef0f0dd7012c46f483ab09d785431ba5813c2080d8468a52e8ec32c745f49d`.
- Outer `lorddemo.exe` is an original DOS ZIP self-extractor, SHA256
  `02845e9043dcb74dfa7016992d5b03ee42fddd63c829f8fcd583f73c8c7aad0e`.
- Its `L2DEMO.EXE` is another ZIP self-extractor, SHA256
  `3429ae27a800e7fbfd341aeac4cb93c29dd495056ac33952aef03af71cd5c35e`.
- Nested distribution: 181 files, 14,382,323 bytes. Complete hashes and executable
  headers: `test/candidate-corpus/lords2-demo-files.json` (relative to `original/`).
- `SETUP.EXE`: NE Windows executable, 31,168 bytes, SHA256
  `c9844241cf6594050cb4cdde5b04d4f994dfa6da83a3c5538dab16e792aa49b7`.
- `FILES/LORDS2.EXE`: PE32/i386, 718,848 bytes, image base `0x400000`, SHA256
  `c83df505c4be850c10425f1770090ba3ca31fa6b87d8bce2cde3c66ae11dd0dc`.

Original README identifies Sierra's demonstration and says to expand with
INSTALL.BAT then run SETUP.EXE. INSTALL.BAT only invokes `L2demo.EXE -d`;
static ZIP extraction retained the same bytes without running either wrapper.
SIERRA.INF says `CanInstallDOS=No`, `WinVer=395`; its original setup copies
FILES into the selected destination and writes program-manager/Windows registry
entries. GAMETIPS.WRI describes the playable six-county map against the Knight,
population management and player-created armies. It is not a cinematic trailer.

The README includes warranty terms. LANGUAGE.INF contains Accept/Decline
strings; this does not establish whether setup will present a licence dialog.
No prompt was executed or answered. Preserve any actual licence prompt and
stop for the existing user decision rule. Do not synthesize installed registry
state or bypass setup based solely on loose FILES availability.

## Recovery and next ordinary route

Remote-only source fixture is `/home/user/lords2-original-20261015` on
`bx_9ef2wdsw`. Local payload was not restored; local free space was 2.25GB.
`tools/acquire-lords2-demo.js` verifies the pinned outer archive; then
`tools/inspect-lords2-demo.js` validates/tests both nested ZIPs and records all
original hashes. Use new destinations; scripts refuse overwriting prior runs.
The generic corpus recipe mirrors those two extraction stages. Its browser
preparation describes the original setup tree, not an installed game.

Registered private app `lords2_demo_setup` points to
`test/binaries/candidates/lords2-demo/original/SETUP.EXE` and the candidate's
generated browser manifest. It is absent from DESKTOP_APPS. The canonical
candidate directory and generated metadata are staged in the isolated source
root `/home/user/lords2-preflight-source` (not in a full runtime checkout).
`tools/prepare-lords2-demo.js` verified all181 originals then used the production
browser-manifest generator:180 support files, SETUP.EXE excluded, each URL
`original/<relative>` and each guest path `c:\\<relative>`, no doubled prefix.
API `cmd_xfofmvybmfsq` passed at15:02:46.795Z. Registration does not claim local
fixture availability or successful launch.

After coordinator reviews this manifest, stage the original tree at that
canonical path, prepare the manifest and verify every file against the inventory.
Use the existing reviewed module with recorded source/module hashes. First
ordinary setup observation: 90-second guest limit, 120-second external watchdog,
640x480, normal renderer input only. Capture before clicking; stop at any licence,
restart/system-install decision or unsupported API. Export actual installed tree
and registry only if ordinary setup completes without an unanswered decision.
Register the captured installed LORDS2.EXE route afterward.

For gameplay, a separately granted 180-second bounded run should reach the
original map through ordinary UI, capture baseline, then select an actual county
and adjust a visible population/tax control or create/move an army according to
GAMETIPS. Capture the concrete state change and reviewed map screenshot, plus
input receipts. An intro/menu, timed animation or selection highlight alone
does not qualify. Performance, audio, combat and public deployment remain separate.

Validation: Node syntax/registry assertions and diff checks pass. The existing
candidate browser-manifest regression passed its645-file fixture, stable
prepare/reuse, sidecar exclusion and save-preservation checks. The CLI corpus
test could not load `compile-src` in the sparse checkout; no compilation or
guest execution was attempted, and that runtime test remains pending.
All181 original hashes rechecked unchanged at15:01:38.759Z, with no runtime
processes present. The first postflight command had a newline quoting error;
the corrected read-only check passed and did not modify the fixture.

Acquisition API `cmd_zv8i2qpyppms` exited0 at14:57:24.841Z; nested inspection
`cmd_ibmmovp2wqlf` exited0 at14:58:00.126Z. All three archives pass 7z CRC testing.
Evidence recovered through exec API into
`scratch/runs/20261015-lords2-original-preflight/`: receipts, all inventories,
original README/SIERRA.INF/LANGUAGE.INF/GAMETIPS and listings. No SSH, guest,
build or browser process was used. These are source evidence, not runtime results.
