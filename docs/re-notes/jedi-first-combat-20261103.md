# Jedi original demo: visible target collapse, hostile encounter unverified

The single bounded original-menu session advanced beyond the [previous ordinary controls result](jedi-original-loading-gameplay-20261103.md): ordinary movement approached a visible humanoid, and one pistol shot was followed by its visible collapse. **A hostile enemy encounter remains unverified.** The short yellow-brown target is consistent with an Ugnaught civilian. This run must not be recorded as an enemy defeat or a completed hostile combat encounter.

No production code changed. Evidence and recovery helpers are in the gitignored `scratch/runs/20261103-jedi-first-combat-encounter/`; `RECOVERY.md`, `encounter-findings.json`, `visual-reviews.jsonl`, `live/` and the retrieved session record the result and its limits.

## Reviewed ordinary route and visible effect

One original Play → Player/Medium → Single Player → New Game session was used. The opening movie was allowed to run. The blank player name was entered through ordinary keyboard input; Medium remained selected. No map/engine shortcut, movie skip, guest patch, configuration/registry shortcut or repeat campaign was used. Reviewed captures preceded each subsequent steering action. Up, Left and Ctrl were released after their bounded holds.

| Capture in `live/` | Engine batch | Reviewed finding |
| --- | ---: | --- |
| `world-baseline.png` | 686324 | First-person courtyard and pistol; ammo100. |
| `target-approach.png` | 1395649 | Ordinary movement brought the short humanoid near the doorway into close view. |
| `pre-fire-target.png` | 1469531 | Target upright and centered in front of doorway; ammo100. |
| `fire-result-01.png` | 1538519 | After Ctrl down1537930/up1538018, ammo099 and target visibly collapsed below the pistol. |
| `target-aftermath.png` | 1583320 | Collapsed target persisted without another shot. |
| `aftermath-wide.png` | 1761919 | Ordinary movement/turning produced a wider view of the doorway remnant; ammo099. |

The visible target change is distinct from weapon recoil and ammunition consumption. It supports a visible shot-associated hit/collapse, without a numerical health/damage reading. Read-only inspection of the authentic `09fuelstation.jkl` after the shot found the `ug` template inheriting `_civilian`, using `ugalt.3do`, `actor_ug.cog`, health30 and `peddefault.ai`. That supports the appearance-based civilian inference; it does not establish this rendered actor's identity through runtime state. The later armed humanoid in `encounter-final.png` could be the player/idle camera presentation and supplies no hostile-enemy evidence.

The concrete blocker is navigation and positive hostile-target identification within the single finite session. No incoming attack was verified; player health/shields remained100/100. Audio, vertical look and separate projectile impact remain unverified. No host/runtime fault was established, so no speculative repair or unchanged retry was attempted. The next useful gameplay task is to identify and approach a positively hostile actor through the ordinary route before firing.

`gameplay-baseline.png` is a loading capture despite its filename; it is not the gameplay baseline. Two early capture requests found controllers not listening yet; readiness was checked before further input, without restarting the guest. These capture-readiness events are retained and are not presented as guest failures.

## Source, build and original invariants

The exact Alice-opening-controls then GL-copy-context author releases were recorded before production ownership, source staging, build, boat creation or runtime. Source sealing used main commit `c35d96ebde15730b9489efacde37e6ab91b2e0c4` plus the actual5905-file input closure. Shared-tree differences are retained explicitly; the run is not described as a pristine commit-only build.

- Fresh boat-side `flock /tmp/wine-build.lock bash tools/build.sh`: PASS.
- Focused tests: `test-shell-cli-routing.js`, `test-winexec-readiness.js`, `test-keyboard-message-lparam.js`, `test-process-desktop.js`: all PASS. Four observer authority/guard/fork controls also passed before guest execution.
- Module:2083916 bytes, SHA256 `446294d1ad655acc46eb5fc3684b91580b800961c75b4343b0b60993c353646a`. All three actual process compile/instantiate records match it.
- Source closure seal SHA256 `81f3eadc447d54fc49198f6ec4ea400be433149ea85e130a272d794b0b84317b`; all5905 inputs checked unchanged after runtime. Recovery references5823 exact git blobs and82 separately verified compressed content-addressed deltas.
- All28 installed original files, totaling39900850 bytes, and220 runtime members matched their full hashes before/after. All76 original registry values remained unchanged; the allowed guest-added child `Version0.1` was retained separately.
- Genuine DSOUND.VXD/DDHELP, builtin DDRAW/DSOUND and pathguards were preserved. Both original WinExec calls remained. The duplicate engine process4008 exited through its own FindWindow/ExitProcess branch; process4004 owned the surviving engine window.

The guest ran900.025 seconds. Outer terminal was957.405619343 seconds, within960, with exit-9 and reason `outer finite deadline`. This was harness termination, not a normal guest exit. Full logs contained no RuntimeError/unreachable/uncaught-exception first cause. The provenance verifier's `gameplayVerified:false` is its deliberately nonvisual default; the separate reviewed captures establish only the specific visible findings above.

## Evidence retrieval and lifecycle

The independently verified143-member evidence archive is8032629 bytes, SHA256 `257311c9c0cb762ef4e16128c369c0d0076d272aa769f200ca5a76a39d95fa6f`. Stored and decompressed original member sizes/full SHA256 values were checked. It retains32 captures, input/state/log records, actual module provenance, original/registry checks and scoped-helper absence. Local source recovery and all82 deltas were also verified. No duplicate local source or original-install archive was created; originals were streamed directly to the new boat, and local free space stayed above2GB.

Only new boat `bx_3y7gme2c` was used: TTL3600, original expiry `2026-11-03T11:17:24.203Z`, shutdown owner `jedi-first-combat-encounter`, recorded before first use. After verified evidence retrieval, a corrected recovery note was uploaded and retrieved with matching SHA256 `43c3c0c400e189a4d07bd41b17c2698f3cd78d0c6d34b549835c1e5b2299b52c`. Scoped helpers and observer ports were absent before the explicitly delegated normal stop.

Stop `stop_56b3630df19d3047` completed at `2026-11-03T10:42:49.890Z`: **STOPPED**, `error:null`, `forced:false`; normal snapshots and metadata retained, snapshot available. `shutdown-verified.json` and `boat-after-stop.json` retain the receipt. No predecessor or other boat was operated, and no assigned boat remains running. No public deployment occurred.
