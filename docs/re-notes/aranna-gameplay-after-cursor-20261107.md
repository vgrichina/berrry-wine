# Aranna gameplay after cursor fix, 2026-11-07

The corrected launch completed prerequisites before spawning and retained the actual runtime locks through cleanup. The ONE unchanged original reached ordinary EULA acceptance and a visibly rendered intro. It ended at the first concrete blocker: the capture harness evaluated a detached guest worker and failed to save the next screenshot's state. Main menu, Choose Hero, name, Normal, map, world and character movement remain unverified. No original retry occurred.

Evidence: `scratch/runs/20261107-aranna-gameplay-after-cursor/`. Previous passed controls and their limits are documented in [aranna-relative-move-20261107.md](aranna-relative-move-20261107.md).

## Launch correction and tests

Predecessor terminal and explicit release were verified before preparation. Lords2 received first shared use; its explicit local-runtime release at 03:46:48Z and source/build release at 03:47:38Z preceded this worker's lock acquisition. Work stayed in the shared checkout on main. No agents, workers or boxes were created.

The run-specific `launch.py` acquires nonblocking exclusive flocks on `/tmp/wine-local-runtime.lock`, `/tmp/wine-browser.lock`, `/tmp/wine-heavy-runtime.lock` and `/tmp/wine-build.lock`. The same foreground supervisor retains their file descriptors while the browser runs and while cleanup is verified. Each authenticated command checks the holder PID and the matching WRITE FLOCK PID/inode entries in `/proc/locks`; it also rejects replaced lock paths. Failed release, disk, source, media, module or inherited-control prerequisites prevent browser spawn. There is no assertion/launch shell separator that can continue after failure. The one-attempt marker is written only after the served module and live locks pass.

Three focused launch regressions passed: failed prerequisite never spawns; busy lock never spawns; locks remain unavailable to a child for its entire execution and become free afterward. `flock /tmp/wine-build.lock bash tools/build.sh` passed before the original. No tracked emulator or harness source was changed; the launch correction and its tests are retained as small run-specific inputs and patches. The detached-worker capture defect was left unresolved after ending the run.

## Exact tested identity and inherited controls

Cursor snapshot fix `8c51623f2f3bd785e2fb04b85536ce19c11538c3` and atomic publication `344c54a2cebb0af51858c80b78c18e665dc52080` remain ancestors of main. Runtime JavaScript, including the renderer, driver and command publisher, matched the prior qualified source hashes exactly. Both modules' passed composed browser controls were inherited explicitly; the full investigation was not repeated. Stale refusal, balanced gestures, UNKNOWN/no replay, native target proof and production pointer-lock checks remain enabled.

| Retained module | SHA-256 |
| --- | --- |
| standard baseline | `07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e` |
| standard observer, actually instantiated by this original | `e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31` |
| compat baseline | `1d4bd4330ea16947959e3f4472339d5a32a61216cd8b5246198d11046b652c3e` |
| compat observer | `6b5edb202b5e03d84056b8663869f8485de2b5a7d592ece0e350dc43a88a005d` |

The current full-build outputs include Lords2's published Win16 change; they are not substituted for these previously qualified modules. `source-identity.json` pins the actual runtime JavaScript and helper inputs at Git commit `7b85bcf938a143bec540116893904b54f410a4b1`, with relevant binary diff and untracked-file patches. The selected observer's original module metadata remains preserved. Actual Worker debugger bytecode confirms the standard observer hash, including slot0/endpoint1 through the last successful capture. Source postcheck passed. All 28 existing media references passed size/SHA-256 precheck and postcheck. No media, configuration or save was patched, and no source/media archive was made.

## Actual progress and first blocker

The bounded execution began 03:48:35.588Z; browser supervisor launched 03:48:38.457Z. Original-resolution 1001×800 captures were personally inspected:

- `startup.png`: original End User License Agreement. An ordinary trusted click on the visible Accept button completed with balanced DOWN/UP.
- `response-00.png` and `response-01.png`: EULA dismissed, black boot surface and advancing resource reads.
- `response-02.png`: rendered black-and-white intro landscape. Ordinary Escape completed to skip it.
- `response-03.png` and `response-04.png`: black transition surface; no main menu inferred.
- `terminal.png`: shell Ready, no guest window.

At 03:51:04.920Z, observation-only command4 saved `response-04.png` but the screenshot hook caught `Execution context is not available in detached frame or worker .../lib/guest-worker.js?v=dev`. Its sequential `readPage()` enumerates page workers and evaluates each one without handling retirement during that enumeration. The exact failed worker slot is unknown. This is a demonstrated capture-harness blocker; it does not establish an emulator crash or a game compatibility failure. The command receipt said completed, but the required state file was absent. No subsequent game input was attempted, no evidence was fabricated, and no observation or input was replayed.

Atomic normal Quit5 completed at 03:51:20.075Z; supervisor terminal was 03:51:20.390Z, code0. The only queued game inputs were EULA Accept and Escape. Both completed; no input UNKNOWN occurred. The run ended before native menu arming or target proof was needed. Existing predecessor UNKNOWN records were untouched.

## Cleanup and next work

Before releasing locks, independent checks confirmed ten owned runtime PIDs absent, HTTP36987 and CDP36407 refused, and `/tmp/wine-assembly-input-pAIqE6` absent. The foreground lock holder remained alive through that check. After explicit release, holder1375948 also exited; final verification confirmed all eleven recorded PIDs absent and all four locks independently free. Source/build/local-runtime release was posted at 03:51:54Z, approximately 3m19s after the bounded execution began. `/home` free space was about 2.93GB. No box was assigned or created: ID/state/expiry/ownership are none.

Next work is to correct and regress worker-retirement handling in capture identity collection while retaining exact live owning-worker validation. A separately authorized fresh original would then be needed for menus/world/movement. This run stops at its first blocker; it makes no gameplay or movement claim.
