# Alice and Return Fire ledger reconciliation, 2026-10-18

Source-only audit against main `84177af7e6dba02ed72c6a21ec7ea060e1e3af8c`.
No build, game, browser, diagnostic replay or new screenshot review was run.
This note supersedes the *current-state* interpretations of the historical
[Alice](alice-demo.md) and [Return Fire](return-fire-demo.md) journals; their
dated observations remain historical evidence, not current-main qualification.

## Alice: implementation integrated; original gameplay revalidation remains

`git merge-base --is-ancestor` confirms serialization commits `cfe411bdc`,
`1b3c20aec`, `7a2953021`, `89524faca` and lifecycle commits `83947f6a6`,
`57a148044`, `321e734aa` are ancestors of the audited main. Current
`lib/dll-loader.js` retains the mapping lock, callback gate, generation pins
and detach service; `src/08b-dll-loader.wat` retains lifecycle metadata and
locked graph mutation. Concurrent mapping, import-graph, callback and Worker
lifecycle regression sources are present. This inspection does not rerun them.
The held `d5a47f240` itself is not an ancestor: its exact integration is not
required to acknowledge the later merged implementation.

Recommended `NEW-GAME-ALICE-DEMO-20261009` replacement:

- Status: **blocked (original media/evidence recovery and post-merge gameplay
  revalidation pending)**; worker: none / awaiting original-media recovery.
- Next: Serialization and generation-aware unload are already on main; do not
  redo the old staging/lifetime fix. Recover original Alice media and the
  retained historical capture, then validate ordinary New Game/Easy and W
  movement on an exactly pinned current build, including browser input.
- Keep the existing Done criterion. Historical native movement is documented
  in `20261009T2151Z-alice-lifetime-gameplay` on wasm
  `a2dae641d95a288c70eee7e61d08f560f5da5b3de62a2b1fcd75e51fc5fb9303`,
  main `23614c85e` plus `candidate.patch`. Do not attribute that gameplay to
  later `47fd3ba3`, `d5a47f240`, or current main. Browser gameplay is not established.

The local paths `test/binaries/candidates/alice-demo/`,
`test/binaries/win98-games-a-d/american McGees-alice_demo-OpenGL.exe`, and
`scratch/alice-preflight-20261009/` are absent on this host. Original archive
recovery must match the journal's 82,499,584-byte SHA256
`ce873bf2525041a624c1a5a27b513f135b51ffdbeae9f68a6ede3edd8c7078e6`.
The historical `2151` run's `finding.json`, `candidate.patch`, `step-6.png` and
`step-8.png` were not found in the bounded local `/tmp` and shared `scratch`
file inventory. Old remote paths are recovery leads, not verified live copies.

## Return Fire: historical gameplay recorded; local evidence gap is separate

Registration `bf7f76236`, palette/depth fix `c7e568b90` and media recovery
`4fce785ae` are ancestors of audited main. `lib/apps.js` still registers
`return_fire_demo` with real indexed `desktopColorDepth: 8` and its local
manifest. No duplicate display fix or registration is needed.

The journal records reviewed ordinary H deployment/W movement in native run
`20261009T2046Z-return-fire-realized-native` and browser run
`20261009T2050Z-return-fire-realized-browser`, both tied to module
`527004d9512965c6b9488799baf90ed8d6ec4e867b7accd6ae32eba09b16d363`.
That meets the row's *recorded* gameplay scope; audio/FPS were explicitly
excluded from its Done criterion and must not keep implementation active.
However, this audit cannot independently renew the visual qualification:
neither run directory, screenshots, exact patch/input receipts nor audio run
`20261009T2052Z-return-fire-browser-audio/gameplay-audio.webm` was found in
the same bounded local inventory. Prose is not a substitute for those artifacts.

Recommended `NEW-GAME-RETURN-FIRE-DEMO-20261009` replacement:

- Status: **review (historical gameplay recorded; original capture recovery
  pending)**, rather than active implementation or newly verified done.
- Next: Recover the `2046`/`2050` capture bundles and review their original
  build/input/screenshot evidence to close the existing criterion. Current-main
  revalidation, audio quality/sync, sustained play and logical FPS are separate
  coverage work; no such measurement is claimed here. Local-only registration.
- Evidence: retain the historical run references and add
  `scratch/runs/20261014-return-fire-recovery/{source-receipt,validation}.json`.

Unlike Alice, original Return Fire media is locally available. Read-only hashing
in this audit passed all 58 files against
`test/candidate-corpus/return-fire-demo-files.json` under
`test/binaries/candidates/return-fire-demo/RFIRE/`, plus the 942,701-byte archive
`scratch/runs/20261014-return-fire-recovery/RFIRE.zip` against SHA256
`8e55e2761753d1773cbf52d86eb30900a977f7b281ccc920ffb80fbb5b5e56be`.
The 59th local file is the launcher manifest, not an original payload file.
The recovery receipt explicitly says `runtime: NOT RUN`; it cannot replace
the missing gameplay captures. No remote artifact search was performed.
