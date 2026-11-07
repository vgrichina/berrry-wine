# Aranna capture retirement, 2026-11-07

Capture repair `727eb72cbba185c223985cded627d0aa5df7525c` is published on main. Seven focused regressions, an actual Chrome/CDP retirement test, the three inherited launch regressions, and the mandatory locked build passed. The ONE unchanged original reached a visibly rendered main menu with complete screenshot/state evidence. It stopped at a run sequencing blocker: I armed the native observer before trusted pointer-lock acquisition. Choose Hero, name entry, Normal, map, world and character movement remain unverified. No original retry occurred.

Evidence: `scratch/runs/20261107-aranna-capture-retirement/`. The predecessor's failed worker slot remains UNKNOWN; no owning-worker crash is inferred.

## Capture correction

`tools/capture-worker-census.js` separates successful worker observations from retirement records. It records debugger target/session identity before asynchronous evaluation. A recognized detached-context error is recoverable only when worker destruction or absence also establishes retirement. Its slot and endpoint stay null when evaluation could not obtain them. Other errors propagate.

An explicit required-owner policy is mandatory. A required owner must have one matching slot, non-null endpoint, the actual debugger-bytecode module hash, and no identity errors. The collector verifies continued membership and re-reads that exact owner after the census, comparing slot, endpoint, target, session and module. Owner absence, ambiguity, retirement, revalidation failure or changed identity fails closed with the partial observation attached. An auxiliary failure cannot substitute for an owner. The run-local identity adapter uses the retained bytecode collector, pins the first live owner across active captures and input checks, and records identity failures separately. Normal cleanup has no active owner requirement after the guest is stopped.

Focused tests cover auxiliary retirement before and after the owner read, retirement of the owner during its own read, owner retirement while an auxiliary read yields, revalidation failure, arbitrary/unproven errors, missing policy/owner/module and changed endpoint. The actual-browser test instantiates an eight-byte WASM module in an owning worker, terminates an auxiliary between enumeration and evaluation, and preserves its valid owner observation plus the truthful auxiliary retirement. It then terminates the owner and verifies fail-closed rejection. Chrome was `151.0.7922.108`. The actual browser test and seven unit tests passed; `flock /tmp/wine-build.lock bash tools/build.sh` and all three launch regressions passed before the code commit. This is capture handling, with no production runtime JavaScript change.

## Exact original and scope

The predecessor's actual terminal, explicit final release at 03:55:31Z and coordinator process-absence/turn-completion report were read before ownership. Lords2 explicitly used a separate immutable remote runtime; no overlapping source files were claimed. No agents, workers or boxes were created. The four-lock supervisor retained the actual local-runtime, browser, heavy-runtime and build locks through independent cleanup. Launch prerequisites fail closed before spawn. The bounded interval began 03:59:39Z with a 04:34:39Z deadline, including cleanup.

Runtime source identity is Git `727eb72cbba185c223985cded627d0aa5df7525c`, `source-identity.json`, relevant binary diff and new-file patches. Cursor fix `8c51623f2` and atomic publication `344c54a2c` remain ancestors. Qualified runtime JavaScript matched the inherited controls exactly. The original actually instantiated standard observer SHA-256 `e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`, confirmed from Worker debugger bytecode. Other inherited modules remain standard baseline `07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e`, compat baseline `1d4bd4330ea16947959e3f4472339d5a32a61216cd8b5246198d11046b652c3e`, and compat observer `6b5edb202b5e03d84056b8663869f8485de2b5a7d592ece0e350dc43a88a005d`. Current full-build outputs were not substituted for qualified modules.

Personally inspected original-resolution 1001×800 captures:

- `startup.png`: EULA with visible Accept button; ordinary trusted Accept completed with balanced DOWN/UP.
- `response-00.png` and `response-01.png`: black boot surface, no menu inferred.
- `response-02.png`: rendered grayscale globe intro; ordinary Escape completed.
- `response-03.png`: distinct robot intro; a separately reviewed Escape completed.
- `response-04.png`: Dungeon Siege Legends of Aranna logo.
- `response-05.png`: stone menu backdrop, no menu text yet.
- `response-06.png` and `response-07.png`: actual Main Menu, including Single Player, Multiplayer, Options, Continue and About/Log.
- `terminal.png`: shell Ready, guest surface gone.

All ten screenshots have corresponding state files; no screenshot receipt alone was treated as complete evidence. Active captures retain slot0/endpoint1, target `0DE7337AF631FCACBF1ECEE384EB9508`, session `98CC0385339DFC78BAA762D766B606B6`, and the expected observer hash. This original did not happen to capture a retirement during a census; the actual-browser regression supplies that race evidence.

## First blocker and cleanup

Observer-only command7 armed the one-way native observer while unlocked. Its response has `mode=absolute`, `lock=null`, `stableUnlocked=false`, `relativeWanted=true`. The read-only native-point measurement failed `AssertionError: actual store context`: no post-arm manager-point store existed. The qualified selector admits no absolute movement in that unsettled state, while the armed first-click guard requires native target proof even for an acquisition click. I had armed before the trusted acquisition used by the qualified controls. This is a run sequencing blocker, not evidence of a guest/emulator failure. No guard was bypassed, no native point fabricated, and no input followed arming. No Choose Hero or later route was attempted.

Atomic normal Quit8 completed at 04:04:22Z; driver and supervisor terminated normally at 04:04:23Z. All nine command receipts completed, including observations, arming and Quit; three input commands completed, with one balanced mouse gesture and two balanced Escape presses. There were no input UNKNOWNs, replay, save/config/media edits or relaunch. Native manager-pointer observations and world movement remain missing.

Before lock release, ten owned runtime PIDs were absent, HTTP34581/CDP45639 refused connections, and `/tmp/wine-assembly-input-HUtHmc` was absent; actual holder1393293 still owned all four locks. After release, all eleven recorded runtime PIDs were absent and all four locks independently free. Source postcheck and all 28 media size/SHA checks passed. Explicit source/build/runtime release was posted at 04:04:53Z, about 5m15s into the inclusive bound. Free disk was 2.85GB. Browser-regression cleanup is recorded separately. No box was assigned or created: ID/state/expiry/ownership are none. Git plus patches provide source recovery; no source/media archive or public deployment was made.

Next work needs a separately authorized original whose run plan acquires the production pointer lock before the one-way observer arm, as the qualified controls do. This invocation stops here and makes no world/movement claim.
