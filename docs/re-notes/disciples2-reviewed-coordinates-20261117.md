# Reviewed native pointer coordinates, 17 November 2026

Evidence: `scratch/runs/20261117-disciples2-reviewed-coordinate-space/`.

The published validator compared a logical canvas point directly with a native
USER rectangle. The actual renderer first refreshes its presentation, maps
through the physical output viewport (when present), floors in guest screen
space, and applies ClipCursor. Its ordinary drag/release path clamps letterbox
points to the nearest source edge. Reviewed containment must not use that
clamping to admit a point outside the reviewed image content.

The repair records the renderer-owned logical canvas dimensions, source HWND,
source/destination transform, physical viewport/native rectangle, output size
and filter availability, and native cursor clip with each retained complete
image. Capture checks the same public context before and after encoding. Each
finite intent compares this geometry with the retained capture. A caller's
review object cannot replace the mapping. Target containment uses the mapped
native screen point, including each child ancestor's actual native client
rectangle. Invalid geometry, letterbox bars, clipped-away child pixels, canvas
edges and a cursor clip that would move the intended point are refused.

The renderer still receives the original logical canvas coordinates exactly
once. No input scaling, native queue receipt, native BUTTON witness, DialogBox
identity, independent physical UP, nonce or freshness rule was weakened.

Reviewed captures now encode the actual complete displayed output. When a
separate physical presentation filter owns that output, its full image and
bars are normalized to logical canvas input units before PNG encoding. The
hidden unscaled staging canvas is not substituted for the displayed image.
A viewport without its actual displayed output is refused. The exact encoder
bytes and original capture times remain retained by the existing registry.

An independent oracle executes production renderer input methods over 460
accepted points; 740 other points are refused across identity, scale, offset,
physical DPR, letterbox, cursor clip and boundary cases. Additional units cover
changed viewport, source HWND, output, window, owner, generation, actor, focus,
stale evidence, forged review transforms and nonce reuse.

Authored native PE tests use ordinary ChangeDisplaySettingsA(CDS_FULLSCREEN)
and actual public window geometry. Host sizes 800x600, 1024x712, 1400x900 and
400x300 prove exact native coordinates via the returned queued WM_LBUTTONDOWN
lParam, followed by independently released UP and the guest's `UP after DOWN`
caption. At 1024x712, canvas (868,357) reaches native (700,300). Replaying the
previous published validator over this exact capture refuses the canvas point;
the patched production transport delivers the exact native point. This oracle
does not use the new transform helper to predict delivered coordinates.

A real native DialogBox child BUTTON under the actual presentation filter at
physical 2048x1424 / logical 1024x712 produces its exact typed dispatch-return
receipt and real dialog transition. A separately rendered partially clipped
BUTTON is refused before its handler runs, with false consumption, followed by
independent release. These are authored synthetic protocol attestations, not
claims of personal review of an original game's UI. Selected full PNGs were
also personally inspected after these tests.

The existing fourteen native DialogBox/real BUTTON/fault modes pass, including
generation, retirement, actor, focus, semantic and stale refusals. Guard,
input-owner, current-quest media/helper, reviewed-context and actual transport
tests pass. Normal and early-release native delivery regressions pass. An
additional 250 ms per-pump stress case delivered DOWN and UP but exceeded the
500 ms confirmation bound (1206 ms), so it is retained as a failed timing
experiment, not qualification. The previously qualified 65 ms pump shape is
tested separately and passed at 308 ms in the sealed replay (normal 135 ms,
early release CANCELLED without DOWN). No timeout, confirmation or release
limit was expanded.

VB explicitly released the whole scene, native USER helper and runner files
after publication; integration began only after that release. No function-level
concurrent edits were used. The completed repair passed the canonical flock
build with actual exit zero and unchanged start/end source hashes. Earlier
attempts encountered concurrently owned Neverhood QT census WIP or changing
inputs; they are retained separately and do not replace the stable build.

The sealed seven-case mapping replay and normal/slow/early delivery regressions
use Git `aa89c364bf37d716e26d2251c75f49e22436b4dc` plus the exact owned patch in
`prepublication-holder2/runtime-source.patch`. Foreign WIP is excluded. Its
module SHA-256 is `bc9ce60ee3c95a396f3d60f849b267d6fde84a890454afc6d4956cc5338f33e2`.
All native/watchdog waits completed zero with both EOFs. A first sealed attempt
truthfully refused a missing `test/helpers` dependency before the child BUTTON
case; the helper source closure was corrected and the complete replay passed.
The holders were hash-verified and normally closed with actual successful waits.

No fresh original has started at this checkpoint. The authorized fresh original
route is conditional on material publication and immutable native qualification.

The material repair is local main commit `78d99e63df492695c0355dd4ee1b318052468cf3`.
A further Git-only sealed replay of that exact commit, with no working-tree
patches, passed all seven native cases (including the complete displayed-output
pixel assertion); actual native and watchdog waits were zero with both EOFs.
Its source SHA-256 is `78339c95363bea2dc8c714efe96dfd80cce7d01fd71c070c8f67804d50745f5e`
and its module matches the sealed qualification above. One recipe initially
used the pretty-printed manifest file hash instead of the holder's canonical
manifest hash and was refused before any native/watchdog child; the corrected
recipe passed without a code change.

Publication is blocked: the required strict pull exits 2 because incoming
origin/main changes would overwrite foreign WIP in the D3D worker, guest thread
host, two GL tests, and callback ownership census/revisions. No foreign changes
were stashed, reset, adopted or resolved, and no push was attempted. Owners and
the coordinator were notified on the messageboard. The fresh original was
not started: publication is an explicit prerequisite. There is no map action
or native Quit claim. Next: reconcile those foreign files, publish the material
commit, then qualify the exact published runtime before the one authorized
original route. All task-created native processes and holders are closed; no
box was created.
