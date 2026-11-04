# Stronghold: immutable live recovery fixed; combat unreached

The run-only recovery race from `f5f75afb3` is corrected and exercised against the intact live runtime. Hash checks remain strict. The bounded native attempt reached Zephyr / Very Easy / Rat scenario selection, then stopped when the attempted start left the scenario screen unchanged. No gameplay, recruitment, attack, health decrease or defeat is established by this run.

Evidence is in `scratch/runs/20261104-stronghold-stable-recovery-combat/`. The [prior investigation](stronghold-browser-dependency-combat-20261104.md) retains the original 51997 → 52895 byte race and the recruitment route. Its recruitment result is not a result of this attempt.

## Recovery correction

The durable [run-only helper](stronghold-stable-recovery-combat-20261104.cjs) serializes commands, snapshot requests and close operations through one promise queue. The browser driver uses that queue for actual dispatch and timer-triggered close. A snapshot holds the queue while awaiting pending observer work and fresh state inspection; held controls, active input, nonempty input queue or mouse mask reject the boundary. It then synchronously copies evidence and computes full SHA-256 hashes on the copied bytes, writes the manifest last, and atomically renames a fresh staging directory into its published location. The downloader accepts only published snapshot directories and verifies length plus full SHA-256 for every downloaded or reused artifact. It never manifests or downloads active logs as immutable files.

Console, HTTP and other receipts use synchronous writes on the same Node event loop. The synchronous copy/publication section cannot interleave with those callbacks. This protocol requires that captured files have no external writers or asynchronous filesystem streams. The externally uploaded `commands/` mailbox, Chrome profile and temporary atomic-write files are excluded explicitly. Executed requests remain in the canonical `commands.jsonl`; replies and input/step receipts are captured. The snapshot request's own final reply is written after publication, and appears in a later snapshot. Each published tree is never written again by the driver; readonly files and fresh IDs provide additional accidental-write protection. This is a single-driver protocol, not a general multiprocess filesystem snapshot.

The integrated driver, downloader, actual-dispatch fixture and all run-specific helpers are preserved exactly in `owned-new-helpers.patch`. Reconstruct these small helpers from that patch; no source tree archive is needed. The browser driver imports the durable helper as `evidence-boundary.cjs`. Its final snapshot runs after the queued browser/server close and the final command reply. Recovery reuses already retained bytes by path and hash rather than copying repeated captures/modules.

## Tests and actual use

Run the durable regression with:

```sh
node docs/re-notes/stronghold-stable-recovery-combat-20261104.test.cjs
```

It reproduces the old active-file hash mismatch, holds an asynchronous drain while append and close requests arrive, proves they remain queued, verifies the immutable snapshot after the active stream changes, rejects writes after close and reused snapshot IDs, reconstructs eleven full stream hashes across 100 queued appends, and rejects corrupted bytes. The actual browser-driver dispatch fixture passes locally and remotely: following commands cannot pass the snapshot drain, and held controls/nonempty input reject publication. Existing 64-step, incomplete-ACK, balanced-input, fresh-capture, atomic-JSON and cleanup fixtures also pass. No production file changed, so no production build was required.

Before the one browser, all **2415 runtime pins**, actual Puppeteer **25.7.0** CommonJS/dynamic imports, and five actual loopback HTTP responses with COOP/COEP and pinned bytes passed. The existing runtime and dependencies were reused without installation or source/media restaging. Both module pins remain canonical `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` and companion `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.

Live snapshot `live-a` recovered **79 files**. `live-b` recovered **213 files**, deliberately waiting eight seconds between manifest acquisition and file download while later native commands appended to the active log. Its sealed command stream remained **6443 bytes**, SHA-256 `ac2321908f11185e13da1b4ff5f1ca0cefa3da83a9b33fd2701e1e0b44e6845b`, while the active stream grew to **11382 bytes**, SHA-256 `10cf04b439d79354dfa347ac26df1520d67b2eb739c588d830e75a208b1c8a60`. Exact prefix reconstruction passed. The final closed snapshot recovered **514 logical files**, reusing matching retained files. `verify.py` verifies every logical file against its full immutable manifest and reconstructs the final **16870-byte** command stream from both live prefixes plus their exact suffixes: SHA-256 `518c2f4171b35df2a8da0c584d1851ebbe4d9e5e35ab9bc57d4471a7708bb640`.

All **244 sequential requests** have matching successful replies; **206 step requests**, maximum **64**, total **13184 steps**; **23 input commands**, balanced controls, **18 trusted observed events**, empty final queue and mouse mask zero. All **1054 served-file receipts** match pins. The canonical module was compiled, instantiated and delivered to the Worker route. Actual presentation is Canvas 2D/DirectDraw with guest Worker threads; the toolbar's WebGL label does not establish WebGL use.

## Bounded native result and handback

Fresh deciding captures were personally viewed in separate completed calls before dependent controls. `review/scenario-confirmed.png` shows Zephyr Very Easy (1/10), Rat/Duc de Puce, Normal Game/Human Advantage and 8000 versus 2000 gold. The attempted start used `(777,748)`. After the balanced gesture and additional acknowledged steps, `review/world-drained.png` still shows scenario selection, with input queue empty and mouse mask zero. That filename does not establish entry into the world. Native controls stopped at this first unexpected state; only snapshot and quit followed. Resolving the menu activation is next before recruitment or hostile engagement can be attempted. There was no second browser or reload.

One post-close verification script initially failed with a Python syntax error because a broad `RUN` placeholder substitution also altered the literal `RUNNING`. The failed command is retained in `remote-commands.jsonl`. The checker was corrected to accept root/run as arguments (`closure-check.py`) and passed. This was a verification-helper error after normal browser closure; no further game input or browser retry occurred.

Chrome **28537** ran **05:14:11.184–05:18:24.250Z**, **253.066 seconds**, exit 0, within the 05:20Z hard stop. Actual exec at **05:19:00.060Z** proved Chrome and driver absent, HTTP port **37961** closed and all **2415 pins unchanged**. Recovery finished before **05:23Z**. **bx_285595gz remains RUNNING/API-idle, healthy and hydrated; expiry 2026-11-04T05:33:35.510Z. Shutdown ownership is the coordinator's.** No lifecycle/allocation/resume action was taken.

`source-reference.json` records exact runtime Git `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`, existing relevant binary diff and hashes of existing module/media references; new helper and note patches preserve owned files. No source archive, repeated module/media copy, production edit, guest write, cheat, configuration/game check patch, Save/Load, local heavy runtime, subworker, successor, public deployment or unrelated game occurred. This worker tested and used its own correction; no independent acceptance task was created.
