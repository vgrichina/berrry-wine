# Heretic II: open-air jump, mantle, and elevated Action progress

Run `scratch/runs/20261111-heretic2-open-air-jump-true-trigger-2015/` establishes native ascent and retains it in the four-file `upper2015` checkpoint. Original health1855 and inherited gate inputs remain byte-identical. No runtime/game bytes or actor state were edited, and no causal runtime bug was proved or fixed.

The runtime used commit `0db20330ccd6761a705eea70c5dd9bfc7704c147` and WASM `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`. All 2461 runtime pins passed before launch. A fresh menu-only Load exited natively with code 8; after starting the original docks game, the exact original health1855 restored successfully twice. Standing and ordinary movement were verified. These observations do not establish save corruption or explain the prior worker's connection timeout.

## Actual open-air jump

At `(1510.6921,294.6932,34.03125)`, isolated A with no directional input produced no horizontal displacement. Read-only native samples showed z73.8119 at leveltime263.4, z89.8462 at263.5, sampled maximum z91.9937 at263.6, then z87.3912,76.6224,60.2579 and return to z34.0320 at264.0; vertical velocity settled to zero at264.1. Sampled rise was57.9625 units. Native floor is z0, player mins.z−34/maxs.z25, and the high chamber ceiling is z320. This jump was clear of the southern arch and platform underside; it cannot itself lift the feet to platform top z128.

Full images `software2/isolated-jump.png` and `jump-flight.png`, `passive-player-sampler-jump-flight.json`, and `ceiling-map-readonly.json` preserve the evidence. The read-only observation matched three native position copies, native showcoords, and separately calibrated view yaw. A pointer adjacent to player state remained nonzero in flight, so it was not treated as a decoded ground-contact flag. Contact is supported by position, collision bounds, floor geometry, and settled velocity. Host input duration is not guest simulation duration.

## Native mantle and correct Action trigger

A successful approach began settled at `(1535.1176,397.1940,42.03125)`, facing−28.2865 degrees on a native eight-unit-high surface west of the lip. The actual sequence was Up+Shift+A for700 host ms, released and paused; separately Up+Space for800ms, released and paused; then Up+Space for1200ms. Each dependent input followed inspection of the full previous image.

At leveltime270.8 Corvus reached `(1570.2291,378.3008,81.1779)` with upward velocity. At270.9 he caught the west lip around x1581.97, z104.03125. Subsequent native animation raised z through115,120,136,160,164, then settled at162.03125 with feet at128.03125. `staged-action.png` visibly shows the grab; `mantle-finish.png` shows platform standing and the Ring of Repulsion pickup. `staged-mantle-trajectory.json` includes intermediate render/physics disagreement during animation rather than hiding it. This is observed native mantle consumption, not a measured free-jump height or an injected move.

Entity176 model*55 is the elevated `trigger_playerpushbutton`, target ash, bounds x1648–1688 y272–304 z128–192. Button166 model*45 has targetname ash/target kelson, bounds x1656–1672 y256–264 z160–176. The x1240 region belongs to the west doors. On the platform, Up+Space500ms reached `(1675.4230,303.9803,162.03125)`. After turning toward the north wall and releasing the turn, a fresh Space1000ms produced a visible push animation and depressed red button. Native showcoords subsequently reported `(1676,303,162)` facing−122.56.

The native save comparison identifies door models by their stored classname/targetname/model strings and the1624-byte edict size in the save header. Original health1855 has both `patty` leaves at approximately zero brush displacement. The first native save caught *41 at y−15 and *54 at y+15. After allowing native time to advance, the final save has *41 at y−82 and *54 at y+74, with matching old/current origins. Button*45 returned to its rest origin. Thus both platform ascent and actual door-chain movement are retained. Physical traversal through the west doorway was not attempted.

`upper2015-manifest.json` maps all four final files to their local exported bytes and SHA-256. Final demodocks.sav is1395849 bytes, SHA-256 `3e59c0aeb53b513f49eda2d83cffe0151ea5f183981b815d5a046483fe2d30ba`. Native `save upper2015` acknowledged Saving game/Done. The new checkpoint was exported and hash-verified; it was not reload-tested in this lease.

## Validation and recovery

Stock paused-cycle and helper regression tests passed. No shared code changed, so no new locked build was run; the pinned closure's existing successful build proof is referenced in the run. Short holds and animation continuation caused delayed displacement/turning, but no causal runtime defect was isolated. The first exposed traversal died; projectile/enemy source remains unproved. The successful final traversal restored the originals again before proceeding.

`final-recovery-local-map.json` maps768 remote evidence files to605 unique raw contents, stored as local raw files or gzip. All raw size/hash checks passed locally and independently against the remote files before stop. Read RESULT.md and RECOVERY.md for exact recovery paths and the preserved failure attempts. No source tree archive was created.

Private box bx_2pt9j455 was normally archived at20:53:38Z before its initial21:01:13Z expiry. Stop `stop_bff5b6d971ed095b` completed nonforced with error null. Browser/controller actual wait and both EOFs completed with code0; an independent process inspection found their PIDs absent. The prearmed fixed watchdog exited unfired with actual wait/EOF.

Next: restore the entire upper2015 four-file set into the matching pinned runtime, start the native game before Load, verify platform standing and door positions, then traverse the opened west route.
