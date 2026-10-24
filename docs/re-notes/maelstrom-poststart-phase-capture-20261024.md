# Original Maelstrom: first frame pending in input drain, 2026-10-24

The single diagnostic run **completed first-wave startup and entered the first RunFrame, but did not return from its HandleEvents input drain before the bound**. This is a measured original-program phase, rather than an inference from background stars. At batch36163, the one after-NextWave trace reached EXE0x406378 from the Fade epilogue. At batches39000 and41900, RunFrame entry counted1 while after-input, after-Sync, frame-blit and frame-return counters remained0. Matched original call sites and relocated SDL return addresses corroborate HandleEvents → SDL_PollEvent → SDL_PeepEvents. The exact innermost API and permanent nontermination are not proven.

The [menu](maelstrom-poststart-phase-capture-20261024/menu.png) renders correctly. Both [post-P](maelstrom-poststart-phase-capture-20261024/play.png) and [after scheduled input](maelstrom-poststart-phase-capture-20261024/input.png) captures were inspected: sparse stars, black playfield and teal bottom strip; no visible HUD, ship, movement or shot. A player and ship are initialized in memory. This is **not gameplay acceptance**. First-wave Fade has returned, so continued first-wave fade alone does not explain the final phase. The first RunFrame foreground drawing boundary has not been reached. The earlier HUD call counted1, but its successful foreground presentation remains unproven; these observations do not establish a renderer defect or certify that HUD drawing works.

Complete observations are in the [107207-byte raw log](maelstrom-poststart-phase-capture-20261024/output.log), [counter/player/surface analysis](maelstrom-poststart-phase-capture-20261024/phase-analysis.json), [state and candidate stack words](maelstrom-poststart-phase-capture-20261024/state-analysis.json), [byte-checked call correlation](maelstrom-poststart-phase-capture-20261024/call-correlation.json), and [original disassembly](maelstrom-poststart-phase-capture-20261024/phase-call-sites.asm). No second guest, emulator/harness production repair, binary patch, state forcing, registry operation, clock variant, replacement port, build or main merge occurred.

## Boundaries and actual state

All16 counters were armed before execution; the required WASM exports were independently parsed before instantiation. The exact canonical input/dump/count/pointer parsers passed against this run's actual assembled arguments. Missing instrumentation is not interpreted as zero hits.

| Boundary/address | 30000 | 34000 | 39000 | 41900 |
| --- | ---: | ---: | ---: | ---: |
| RunPlayGame 0x40b0c0 | 0 | 1 | 1 | 1 |
| NewGame 0x406230 | 0 | 1 | 1 | 1 |
| NextWave 0x4064f0 | 0 | 1 | 1 | 1 |
| Player NewGame 0x411300 | 0 | 1 | 1 | 1 |
| Player NewWave 0x411340 | 0 | 1 | 1 | 1 |
| NewShip 0x411410 | 0 | 1 | 1 | 1 |
| Initial HUD 0x4057a0 | 0 | 1 | 1 | 1 |
| Wave stars 0x40682a | 0 | 1 | 1 | 1 |
| Fade 0x416850 (cumulative boot included) | 6 | 8 | 8 | 8 |
| After NextWave 0x406378 | 0 | 0 | 1 | 1 |
| RunFrame 0x4019a0 | 0 | 0 | 1 | 1 |
| After input drain / Sync entry 0x4019ab | 0 | 0 | 0 | 0 |
| After Sync 0x4019c5 | 0 | 0 | 0 | 0 |
| After sprite blit loop 0x401d84 | 0 | 0 | 0 | 0 |
| Frame return boundary 0x401e58 | 0 | 0 | 0 | 0 |
| Housekeeping 0x4063c0 | 0 | 0 | 0 | 0 |

At34000,39000,41900: game-on1, paused0, wave1, player-count1, start-lives3, start-level1, no-delay0, last-star15, last-drawn0, sprite-count3 and gNumRocks0. These are captured values, not assertions that every initialization or drawing operation is correct. The original source distinguishes gNumRocks from the general sprite array. No network mode was requested and Sync was not reached.

The actual after-wave pointer expressions read screen0x0088fac4 and player0x00ad3784. Player vtable0x419a88, ship0x00a7b21c, playing1, dead0, exploding0, reserve-lives2, score0 are directly observed. Two reserve lives agree with ordinary NewShip consuming one of the three starting lives. Screen current and foreground surfaces are both0x0088f954; background is0x008a7fbc. Only64 screen-object bytes were captured; surface pixel buffers and the fade flag at object+0x414 were not read. The trace proves the initialization state, not visible ship rendering.

The repeated39000/41900 stack contains, in increasing nesting order:

| Stack slot | Candidate return | Matched original call |
| --- | --- | --- |
| 0x074ffea4 | 0x40637d | 0x406378 → RunFrame0x4019a0 |
| 0x074ffe98 | 0x4019a8 | 0x4019a3 → HandleEvents0x402850 |
| 0x074ffe74 | 0x40287d | 0x402878 → import jump0x413426 → SDL_PollEvent |
| 0x074ffe60 | 0x67df75 | SDL0x10017f70 → SDL_PeepEvents0x10017cd0 |
| 0x074ffe34 | 0x67ddbb | SDL0x10017db6 → mutex unlock0x10022a70 |

EXE loaded at0x400000. This run independently reports SDL0x666000, so runtime SDL VA = preferred VA −0x10000000 +0x666000. The five E8 call instructions, their targets and captured return slots are checked in call-correlation.json. SDL_PollEvent/SDL_PeepEvents exports and the EXE import binding also match. This is a coherent candidate return chain corroborated by counters, not a formal unwind. Other words, including0x4019b0 and deeper SDL_net-looking values, can be stale; they do not override the measured Sync-entry0. Final EIP0x075040f8 is a generated thunk and does not by itself name an API. Audio-worker state is not evidence of the main-thread cause.

**Next bounded blocker:** determine why the first HandleEvents/PollEvent drain has not returned, including the sampled PeepEvents/mutex-unlock path. This capture does not distinguish an endlessly replenished event queue, time spent inside one poll/lock operation, or an emulator scheduling/API error. No repair is justified solely by the final thunk or background PNG. A separately authorized follow-up would need original SDL/API return observations at this phase, with fresh admission; this worker makes no further run.

## Exact configuration, inputs and controls

Remote main had advanced from requestedf6571101e38985b3fa34d328f2ccadd9735a7573 to **36ca14d2806bd839a7918f99f1d844d5cb9fc8c3** at checkout. The private explicit sparse task branch starts at actual main. [Reconciliation](maelstrom-poststart-phase-capture-20261024/main-reconciliation.json) lists only unrelated D3D9 integration paths; there was no Maelstrom overlap or duplicated work. Root tracked files/index/refs and all donors stayed read-only; only append-only root board coordination was used. Alternates were flattened only in the owned Git configuration. Nesting warnings were not treated as missing objects.

The immutable diagnosis620317f03cd600b0b8b203d03a71890fc22f8594, tree runtime9a1c8fc7ac4d904f65bd4d5f618c84e99c245a52, original closuref23fd7f51168caebb38571e303cb9630e153ef7c and failed-runtime recovery21c91f279cddfc9926b46c6b58be56c98365e293 were reused. No archive reacquisition, source rediscovery or repeated full closure audit occurred. The [247-file manifest](maelstrom-poststart-phase-capture-20261024/manifest.json) pins every staged runtime, original asset, CRT, font and codec file:17027463 bytes. All were rehashed as ordinary UID1000 before guest execution.

| Exact input | Bytes | SHA256 |
| --- | ---: | --- |
| Original archive | 906220 | `6cc9ef78eda9a0c3591dbd6f67b8c534682ef3f30bda0acd3b0138a0a0c52db5` |
| Maelstrom.exe | 135168 | `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5` |
| SDL.dll | 225280 | `02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373` |
| SDL_net.dll | 24576 | `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95` |
| System msvcrt.dll | 278581 | `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1` |
| Historical full WASM | 1879746 | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Canonical run.js | 685960 | `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` |

Original48 files total2794170 bytes. Historical module source isb41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a; harness dependency source isd8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e. **This is not current-main module or native-current-build qualification.** The canonical harness was already recovered in the diagnosis donor parent. Compatible retained ABI inventory has291 imports, memory min8192/max32768 and layout stamp9a3bc9149d58209c. All three original DLL initializers returned1. CRT/SDL_net loaded at0x522000/0x7a2000; both SDL DLLs' preferred base0x10000000 relocated normally.

Pinned pngjs7.0.0 came from `/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs`; package.json SHA256 `85b17f2f852aece03e71edb4ed4d9fddf6a0a8f0b69ac75d7f00b6592d62d37c`, every codec file in manifest. No install/download occurred. The complete canonical dependency preamble, renderer,28 fonts and lossless safe-PNG controls passed on Nodev24.22.1 UID1000. Static export validation did not compile or instantiate the module. See [preflight](maelstrom-poststart-phase-capture-20261024/preflight.json), [actual-argv parser validation](maelstrom-poststart-phase-capture-20261024/config-validation.json), and [tree mapping](maelstrom-poststart-phase-capture-20261024/tree-validation.json).

The actual [command](maelstrom-poststart-phase-capture-20261024/command.json) and [argv](maelstrom-poststart-phase-capture-20261024/guest-args.json) explicitly use no-build/full module, quiet-api/quiet-blocks,512MiB fixed shared arena, oldspace512MiB, max42000 batches, max60 guest-loop seconds and200ms guest clock/batch. All capture-delta additions/replacements were applied exactly; input/max-batches occur once, as canonical parsing is first-match. The single supported tree mount contains only `maelstrom/`, preserving all48 original names, including `Docs/Ambrosia_Software,_Inc._FAQ.txt`, and guest CWD `C:\maelstrom`. Guest environment is `MAELSTROM_LIB=.` and `HOME=.`; no fullscreen or network flags. Actual filename-bearing argv was validated with the canonical parser and full directory enumeration before the guest. Broken comma per-file recipe, wrong root and missing-file controls reject.

The schedule retained menu PNG30000; P down31000/up31200; PNG34000; left down35000/up36000; up down35200/up36200; space down35500/up36500; PNG39000. Four counter/seven-span snapshots occur30000/34000/39000/41900. The one after-wave trace is armed30000, limited1, with validated pointer expressions. All events precede42000;43 parsed events include28 bounded reads. The full raw log records injection batch and screenshot guest-ms. P dispatch occurs between31000 and31200; P-release and movement/fire keydown dispatch receipts occur after the36163 trace and before the36200 injection. Up/space release injection is recorded, but their actual dispatch is not observed. Individual dispatch wall timestamps were not emitted. Counters alter interpreter scheduling: no batch/time equivalence with the previous run is claimed.

## Guards, cleanup and recovery

The guest ran **2026-10-24T07:55:04.269489Z–07:55:15Z**, PGID25122, natural exit0,42000 batches,10.563 guest-loop wall seconds; supervisor elapsed10.769897 seconds. CPU/wall90, output524288 bytes, per-file25165824, max3 PNGs each131072/cumulative393216 were enforced. Actual raw log107207 bytes and PNGs40715/2331/2309 bytes stayed within guards. No output was silently truncated. The safe capture helper preserves actual pixels by lossless reencoding and rejects bad PNG bytes/dimensions. A genuine524288-byte failed-output control and receipt are retained under the private task root; the byte-exact fixture output is ignored, with its reconstruction in supervise.py. TERM/KILL-after5s and descendant reaping were tested by the remote TERM-resistant negative control. The actual guest required neither signal and left no group. [Terminal](maelstrom-poststart-phase-capture-20261024/terminal.json) and [corrected cleanup](maelstrom-poststart-phase-capture-20261024/cleanup-corrected-api.json) confirm cleanup. The initial generic cleanup search matched its own Python command text; the retained rejecting controls and corrected executable-aware probe show taskNode[]. Two local analysis helper return-shape mistakes were corrected without changing guest execution or acceptance assertions; see development-corrections.json.

Initial measured admission projected51775287/67108864 bytes including own Git/checkout, remote closure, local/remote helpers/evidence, transfer overlap, full external session/events/launcher, positive SQLite growth/future allowance and8388608 reserve. Installed tools and immutable inputs were accounted separately. [Launch accounting](maelstrom-poststart-phase-capture-20261024/resource-launch.json) projected49832467 bytes. Both host free-after-increment floors2982150144 passed. Immediate remote free48767410176 and MemAvailable7257153536 passed; the supervisor rechecked MemAvailable7253454848 immediately before spawn. Source parser probes used oldspace256, CPU/wall60 and fresh MemAvailable>=805306368. Internal capture charge317644/1048576 includes conservative150000 prior charges; reads used8192-byte slices. Bounded original code reads/disassembly remain below64KiB. Final measurements remain under the same retained allocation, with no history reset, links concealing copies, repack or removed evidence.

Box **bx_wc4mkcn9 remains RUNNING**, APIstate idle/healthok, expiry **2026-10-24T08:20:57.580Z** at handoff. The coordinator owns shutdown/checkpoint08:15UTC. No lifecycle operation was attempted. Runtime ownership was handed back on the board before publication. No public URL or deployment was created. The worker board watcher is cleaned before final handback.

All compact evidence and helper recipes are alongside this report. Originals/module/codec remain ignored standing inputs; they are not Git-backed by this task. Reconstruct staging from manifest.json with stage.py: it reads pinned Git blobs or original files, verifies length/SHA256, transfers bounded chunks, then rehashes remotely. bootstrap.py records the exact root/box adaptations and delta replacement. Reproduction on retained evidence uses analyze.py, finish-analysis.py and correlate.py; their sole external helper is the immutable diagnosis's tools/maelstrom-poststart-proof.py. validate-config.py validates assembled argv and exports; validate-tree.cjs/preflight.py/supervise.py retain the exact probes and controls. Any future guest needs a fresh explicit coordinator assignment, box/deadline/admission and owned root; the current supervisor refuses a second guest directory. This task stops at this phase finding.
