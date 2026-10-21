# Army Men current-main qualification: canonical prerequisite blocked

Exact source `80f8278a90ed17767ede71f15b5ceff432da5ac4` failed the canonical build on 2026-10-21 at 10:23:57 UTC. No fresh module was produced, and original gameplay/input/scrolling qualification was not attempted. This is the first reproducible prerequisite blocker, returned without production repair or gate bypass.

The remote clean Git checkout `/home/user/army-current-main/repo` on exclusively assigned `bx_e8a7pw8v` was checked against all 7,281 tracked Git blob IDs and SHA-256 hashes before building. All 7,281 hashes and clean tracked status were verified again afterward. Exact inventory is `evidence/source-manifest.json`; postflight is `evidence/postflight.json`. Local shared-root WIP was not used as source.

`npm ci --omit=dev --ignore-scripts` succeeded. Cheap canonical preflights passed: CLAUDE size 22,221/32,768 bytes, all 127 WAT fragments included in canonical order, and individual fragment balance. The required `bash tools/build.sh` exited 1 at `node tools/callback-ownership-census.js` (line 25 of the preserved canonical script), before memory-map gates or compilation:

```
changed producer lib/apps.js:host-file (sha256); review its lifetime
changed producer lib/browser-shell.js:host-file (sha256); review its lifetime
```

| Producer | Census SHA-256 | Exact-source SHA-256 |
| --- | --- | --- |
| lib/apps.js | ae48052ee3b6b827d99b2a61ca74ad934d382d6737a686297fa9cebb58a2a22f | 09aa50e962aae8c8de0495d1820ce2737e0a091092e795688fcba5da62144669 |
| lib/browser-shell.js | 705eed3d465244d383b89d9aacfec98fa7bfbed6282d64040aca6daa2accaa67 | bcc096641ebe4cd587aed5abbf160ef73dfee5bdaae96ad4a7581cec60e6d318 |

`build.sh` is the exact orchestration command sent through the Boat exec API, with `remote.py` retaining the command receipt, full build log and exit status. `evidence/canonical-build.sh` is the checked-in build script. `build-receipt.json` records API command `cmd_2j0ipfuclg69`, exit 1, no timeout/OOM. `evidence/build.exit` is 1 and `moduleExists` is false. Resulting module SHA-256: **null (not built)**.

No original asset transfer, CPU DLL/export or real DLL-graph validation, guest launch, observer capture, or screenshots occurred after this prerequisite failure. The coordinator's 419-original-file verification remains input context, not a fresh transfer-closure claim. No historical module/overlay/evidence was reused as current-main qualification. Boot Camp, Numpad6 acknowledgments, stripe appearance, same-surface paired pixels, browser, FPS and audio remain unqualified.

Separate next assignment: review the two changed producer files against their census lifetime entries and make any justified census/source correction, with normal review and tests. Do not blindly replace hashes. Then assign a new canonical build and original runtime qualification on the resulting explicitly pinned source. This task makes no repair or main merge.

Handoff at 10:24 UTC: same `bx_e8a7pw8v` remains running (Boat API state `idle`, health `ok`), expiry `2026-10-21T12:21:46.313Z`, observed in `handoff-state.json`. Coordinator retains lifecycle ownership; no stop/delete/resume was issued. Remote source, npm dependencies and evidence remain at `/home/user/army-current-main`; no guest process was launched. Evidence has been downloaded locally, independently verified and committed on the isolated task branch. Local task usage was approximately 21 MiB before publication, with 3,928,616,960 bytes free, above the 2,285,895,680-byte floor plus 600 MB reserve.
