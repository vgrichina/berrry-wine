# Descent 3 current browser attempt, 7 November 2026

The registered original `descent3_demo` stops before the pilot screen on current
main. The inspected browser shows **“Failed to retrieve DirectX version.”**
After a balanced, trusted Enter input, it shows **“You must install DirectX
through the Descent 3 Launcher before continuing.”** A second balanced Enter
closes the guest normally (`ExitProcess(0)`). Cockpit, yaw, movement and firing
were therefore not reached. No rendering/input/crash defect was demonstrated,
and no emulator implementation or guest/media bytes were changed.

Run: `scratch/runs/20261107-descent3-current-browser-flight/`.
The registry ID is `descent3_demo`; no matching candidate-manifest row was
present. Evidence is retained under this exact app ID without association to
an unrelated candidate.
The October 6/10 cockpit evidence remains historical. Its local capture
folders are absent, as already recorded by the retained October 14 recovery
audit. The retained route in `descent3-demo.md` supplies the small guest-clock
and cursor-centering instructions; no historical capture was counted as a
current result, and no corpus-membership search was repeated.

## Tested identity and preparation

The tested source commit was `1b6a0d674b9f81d295a0411c08a188519f9732f2`, main.
`runtime-pins.json` records 643 individually staged runtime/media/desktop paths,
sizes and SHA-256; remote preflight and postflight matched every pin.
`relevant-source.patch` is empty; the pre-existing untracked
`lib/wininit-boot.js` is recorded in `new-lib_wininit-boot.js.patch`.
Git plus those patches recovers the relevant source. Other agents' changes
were preserved. No source or media archive was created.

The existing installed media tree is
`test/binaries/win98-games-a-d/Descent3 demo10-installed/installed/games/descent3demo/`.
All 23 browser-manifest entries match their retained declared sizes; main.exe,
soar.dll and the manifest are among the 25 complete app paths pinned before
execution. The manifest contains sizes, not historical expected SHA-256.
`original-media-verification.json` records the present retained bytes' hashes;
this is not independent publisher-checksum authentication or a reconstruction
of unavailable October captures. Media was referenced locally and transferred
individually to the fresh box without making another local media copy.

| Input | SHA-256 |
| --- | --- |
| Standard WASM actually fetched by browser, HTTP 200, 2,182,493 bytes | `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` |
| Compat WASM pinned, not executed | `04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72` |
| `lib/storage.js` | `a31f11a6c33b7e4a27f475bebca5e1a48ce4ebde43bd06716bc16a6439cf3df1` |
| `lib/gpu-backend.js` | `7913166b52ad34b5a7657aefec747aa66bf4b8f4c1cd3e50fa195a7956274ad7` |
| `lib/gl-compat.js` | `b007377dd11a736b3eeb36f8191597b9657323900fe4698f0c489779b8a6380b` |

The standard module also matches the retained November 7 original-graphics/Q3
modules; `source-recovery.txt` names that recovery without duplicating it.
All 99 successful observed JS/WASM responses match the pinned bytes. Optional
`build-info.js` returned 404; the page used its documented `dev` version fallback.
The original registered arguments (`-launched`), app-local soar.dll,
working directory and PreferredRenderer=2 startup registry were preserved.

## Browser execution and causal blocker

The run used Chrome `151.0.7922.108`, Node `24.22.1`, a fresh browser profile,
900×720 viewport, cooperative execution and explicit browser `gl-renderer=webgl`.
A small browser WebGL probe returned `[255,0,0,255]` and a trusted button click
passed before the original launched. This probe establishes context availability,
not game rendering. The run-specific driver adapts the existing
`tools/arcanum-gameplay-browser.js` screenshot/input loop. Its first process
failed on an unused copied helper import before creating a browser or guest;
that harness error was retained and removed before the sole original launch.

The page used `?app=descent3_demo&debug&no-threads&frozen=20&gl-renderer=webgl`.
After inspecting `startup.png`, 1,000 frozen steps at 20 ms reached the first
error (`pilot-progress.png` is a progress label, **not a pilot screen**).
The first Enter used 20 steps held plus 20 released; `after-error.png` shows
the installation requirement. The same balanced input then yielded
`terminal-guest.png`, with no app and normal exit. All four unique captures
were personally inspected. Each has a matched state JSON, and the input
records show trusted keydown/keyup events. No mouse/cursor action was needed.

`live-blocker.json` records the actual browser registry with **no DirectX key**,
plus no GL render endpoints. Static inspection of unchanged original main.exe
supplies the corresponding path:

- `0x4db150` calls RegOpenKeyExA on HKLM `Software\\Microsoft\\DirectX`.
  A nonzero result branches directly to the false return at `0x4db20a`.
- If present, it reads `Version`, then falls back to `InstalledVersion`, and
  requires major version at least 6. The original string VAs and bytes are
  retained in `original-dx-strings.json`.
- `0x4db22a` calls that check; a false result enters the startup failure path.
  Disassembly is retained in `dx-version-function.txt` and
  `dx-startup-caller.txt`.

This explains the current/historical difference without implicating GL.
Commit `58e90870a40a541a4083cae5e987ca8de31889e6` intentionally removed the
invented default DirectX installation version. Current `lib/storage.js`
requires installer/imported metadata, and the registered Descent fixture
manifest supplies no registry snapshot; its startup registry only selects
the renderer. `test/test-directx-registry-metadata.js` freshly **PASS** verifies
absence, supplied metadata, A/W sizing, errors and restore. Restoring a guessed
DirectX version would violate that established behavior. No new rejecting
regression or full build was needed because no production code was changed.

## Recovery and next action

The one fresh box was `bx_xkdafuuv`, created with its UUID Idempotency-Key
persisted before the request. No stopped box was resumed and no held/403 request
was retried. A single original runtime was used. All unique run outputs were
retrieved and hash-verified before delegated normal shutdown. Browser close
returned code 0; postflight confirms both owned PIDs absent, loopback port
38421 closed, profile `/tmp/descent3-EGaacR` removed, and all 643 pins unchanged.
The box was archived at 06:06:30.377Z, normal stop completed with forced=false,
error=null and no active archiveAfter/expiry. No box ownership remains.
Local `/home` stayed above 2 GB during the recorded checks; no public service
or deployment was created.

Next: recover authentic Descent installation/DirectX registry state from the
original setup/launcher or a retained installer-derived registry snapshot,
with provenance, then rerun this registered browser route. Cockpit, ordinary
yaw/movement and firing still need fresh matched captures after that prerequisite.
No FPS, audio, native/browser parity, complete visual correctness, or broader
historical 27-title coverage is claimed.
