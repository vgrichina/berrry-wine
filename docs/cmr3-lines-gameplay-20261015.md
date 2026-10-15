# Original CMR3 replay after line-list support

The original game now passes the previous Stages line-list rejection and reaches
the **UK Warwick Special Stage 1 loading screen** through ordinary menu input.
Loading then reaches `D3D9 software: invalid native free list`; the captured
frame becomes dark gray. No race, driving controls, audio, logical FPS or browser
execution is qualified. This was one bounded software CLI run on `bx_9ef2wdsw`.

`tools/cmr3-lines-gameplay-stage.js` creates the previously nonexistent
`/home/user/cmr3-lines-gameplay`, detached at
`78a06540f49dec6a8061354b5b3baf08d27be55b`. It verifies the clean tested donor
`/home/user/cmr3-software-lines` at `750bc13fd`, rejects differences outside
the explicitly named non-build files/docs, and compares actual bytes for all
other tracked files. Only then does it copy the regular 1,803,537-byte canonical
module SHA-256 `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
It verifies package manifests before copying the existing dependency directory.
Actual staging compared 6,506 identical tracked files, with twelve allowed
non-build differences. Both source trees were clean. The original shared-clone
attempt failed because donor history lacked an ancestor needed by fetch. Its
directory remains at `/home/user/cmr3-lines-gameplay-failed-shared-clone`.
A fresh independent `git init` / shallow fetch succeeded. A dependency symlink
then failed the clean-worktree gate, so it was replaced by a regular directory
copy. All these preguest receipts and exact recovery scripts are retained.
The committed stager now uses those successful operations; this consolidated
recipe was syntax checked, not rerun into another checkout.

The controller `tools/cmr3-lines-gameplay.js` ran from an external script path
so the pinned checkout remained clean. It used a fresh
`scratch/runs/20261015-cmr3-lines-gameplay` under the new checkout, validates
the exact 302 originals, twelve native dependencies, 972-entry registry and
316,640-byte generated profile, then performs actual PNG encode/decode before
guest spawn. Source, module and fixture identities are recorded before/after.
The controller retained the established 540-second guest/590-second outer bounds.
Owner 85638 started at 12:42:50.921 UTC; child 85684 launched at 12:42:51.819.
Node v24.18.1/linux x64, software programmable D3D9, cooperative threads,
640x480, 200,000 blocks/batch and synthetic 200 ms/batch match the prior route.

Screenshots used `node tools/ctl.js -s :8137 png OUTPUT`. Each next ordinary
keydown/keyup followed visual inspection; there was no batch replay, guest
memory write, forced transition, tracing patch or fake dependency.

| Input | Down/up batches | Observed screen |
| --- | --- | --- |
| Escape | 494 / 502 | Title: PRESS RETURN TO CONTINUE |
| Return | 788 / 799 | Main menu, STAGES highlighted |
| Return | 1099 / 1110 | NUMBER OF PLAYERS, 1 PLAYER |
| Return | 1203 / 1213 | Ford Focus RS WRC 02 |
| Return | 1366 / 1375 | Automatic transmission |
| Return | 1458 / 1467 | Country select, Spain unavailable in demo |
| Right | 1608 / 1620 | UK selected |
| Return | 1718 / 1726 | Special Stage 1, Warwick |
| Return | 1843 / 1853 | Stage loading map, screenshot batch 2246 |

Menus after the main menu had plain gray preview areas but readable responsive
labels. Screenshot 13 at batch 7933 and final.png show a dark gray frame.
The first explicit renderer error is output.log line 1653, immediately after
batch 2402: `Error: D3D9 software: invalid native free list`. There are 2,725
copies in the final log. `Device.prepare` at
`lib/d3d9-software-backend.js:495` rejects a negative return from
`d3d_render_coalesce_heap` (`src/09ai-d3d-render-lifetime.wat:159`). The exact
damaged allocator node/state and causal allocation are not captured; do not
infer that line rasterization itself corrupts the heap from this progression.
Shutdown additionally reports `QueueError` code `RECLAIM`, native render heap
handoff rejected, and eight abandoned parked Enter calls. Preserve these as
observations, not a proven common cause. No driving input was attempted.

Harness quit was requested on the identified failure at 12:46:34.693. Child
85684 exited zero at 12:46:34.803 and controller 85638 at 12:46:35.289. All
6,518 tracked source hashes, module, original302/native12/registry/profile
identities remained unchanged. Sanitized PID/PPID/comm inventory at
12:46:56.583 contained no runtime survivors; sole-runtime ownership was
released to root. Zero here establishes cleanup, not game success.

Shared evidence: `scratch/runs/20261015-cmr3-lines-gameplay/`. All thirteen
screenshots and final.png were inspected. The archive is 863,863 bytes,
SHA-256 `b57928030d70840875bead6deb0b8e634ce4a8ca2dd5053eff23d9b0d91ceace`;
all 26 remote artifacts / 2,044,242 bytes were independently hash verified
after extraction. Local action/staging/owner receipts supplement that archive.
No corpus ID exists; investigation metadata is published last without attaching
to another game. Git preserves recipes/notes, not ignored fixtures or artifacts.

Preparation checks: both scripts pass `node --check`; `git diff --check` passes.
Actual fixture verification, PNG preflight and postflight passed. Stage loading
is established; gameplay remains blocked as described above. Future runtime
requires a fresh sole-owner grant and enough sandbox lifetime for cleanup.
