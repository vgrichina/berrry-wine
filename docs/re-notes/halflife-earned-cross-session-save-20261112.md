# Original Uplink earned cross-session checkpoint — 2026-11-12

A reusable native checkpoint is **qualified** at the damaged stair chamber
entrance, health100 / armour0, elapsed00:45. Ordinary New game → Easy earned
this position; native Save wrote it; backward movement changed the position;
normal Load returned to the chamber and accepted fresh right strafe. A second,
fresh Chrome process/profile then mounted the **unchanged exported bytes**,
loaded through the native Load game menu, returned to the saved chamber, and
accepted fresh right strafe. The second browser did not replay New Game or the
opening. “Saved” and the UPLINK list entry are supporting observations, not the
basis for persistence qualification.

Run: `scratch/runs/20261112-halflife-earned-cross-session-save-1430/`.
The authoritative export is `earned-native-save-s29-export.json.gz`, bound by
`earned-save-manifest.json` and `postflight.json`. It contains all four complete
game-written files, 324084 bytes total:

| Original VFS path | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\valve\save\half-life-000.sav` | 164727 | `7df87bd87c7e0b46f5bad250407bd13c6d8cf6fab2e0e0e82521f3ccbf54b346` |
| `c:\valve\save\hldemo1.hl1` | 158093 | `6b12dc054d01297200cb2684c6332ad103960bf3fa689d080a972ce743bd67bf` |
| `c:\valve\save\hldemo1.hl2` | 1260 | `591db0add36af1d53b4d71b4899a715e176388ff4c005dfe43600b280c32b48a` |
| `c:\valve\save\hldemo1.hl3` | 4 | `df3f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81119` |

## Recovery without replaying the opening

Verify the gzip against `earned-save-manifest.json`, decode its JSON, and
base64-decode every `files[].data`; verify each original size and SHA-256 before
mounting. Mount all four at their recorded `path`, using normal loader entries
with `vfsPath`, `size`, `sha256`, and `loadMode:"required"`. Keep the original
media unchanged. `restore-mounts.json`, `restored-save/`, and
`recovery-prepare.py` retain the exact tested preparation. They are save-file
mounts, not config, registry, clock, memory, AI or position changes.

Use a fresh browser/profile and normal launcher. Select native Configuration →
Video → Video modes → OK driver advice → OpenGL / Default /640×480 → OK; return
to main menu → Load game → highlighted UPLINK → Load game. Loading takes time:
request and review new full captures. There was no current game to exit in the
fresh browser, so it needed no exit-current-game confirmation. The native list's
file date reflected the new mount time; the bytes and elapsed00:45 were verified.

`recovered/webgl2/restored-save-set-verified.json.gz` proves the complete mounted
set matched the original export **before native Load**. Distinct Worker targets,
document epochs, Chrome processes and profiles establish the fresh session.
Do not replay either closed command stream. Establish a new ownership/capture
chain, then verify the loaded world and fresh movement before further input.
No historical floor export was substituted; that old checkpoint remains separate.

## World evidence and original pins

Full frames under `review/webgl/` show `s17-bound` at the initial corridor,
`s18`–`s22` forward consequences toward the broken stair chamber,
`s27-native-save` with Saved, and `s28-move-away` / `s29-export` farther back near
the yellow lamp. `s33-loadselect` is the ordinary confirmation;
`s34-loadconfirm` starts loading. `s35-loaded` returns to the chamber and
`s36-loaded-move` shows a fresh right strafe, with the right wall approaching and
the left door becoming visible. Under `review/webgl2/`, `r14-loaded` and
`r15-bound` return to the saved chamber; `r16-fresh-move` shows fresh rightward
movement and the left LAMBDA door. Health100 / armour0 persists. This qualifies
the chamber checkpoint, not new combat or a new crate-bay route.

Frozen source commit: `0d664d40d9e89217dba942968e5c6fa959a678bf`.
`relevant-source.patch`, `new-helper-patches.patch`, `final-helper-patches.patch`
and the recovery annex pins preserve relevant uncommitted inputs. Git remains
the source archive; no source-tree or source-media archive was made.

The original65-file manifest passed. `hldemo.exe` SHA-256 remains
`e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`;
`pak0.pak` remains
`c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`.
DLLs use normal mounts. Both actual guest and owning renderer bytecodes hash to
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Both cases actually use SoftwareGL: GL endpoint1, bridge `software:true`,
HWND65564. A separate legacy WebGL endpoint and the page dropdown do not prove
the game backend. All22 binding fields stay strict through the first browser's
normal Load; the fresh browser has its own independent binding.

## Tests, limits and closure

The actual staged import gate, missing-dependency negatives,102 emitted key/wait
forms,16 binding negatives, three independent-release tests, and corrected
read-only `wine._helpCtx.vfs` exporter/actual emitted export fixtures passed.
The retained21-second ACK/API1…600/same-operation observation/unknown-publication
no-replay tests passed. The inherited37-check caller result is referenced, not
rerun. The fresh-browser annex was hash-verified remotely, passed its exact
staged import gate before startup, and verified actual mounted save bytes before
Load. An initial invocation used a nonexistent pulse-test path; the corrected
`tools/native-input-pulse.test.cjs` passed. No production source changed and no
production build is claimed.

`postflight.json` rechecks all634 recovered references, both module identities,
all22 strict binding fields, and111 trusted/balanced input events (74+37).
Unique logs/modules were compressed before retrieval; reviewed images were
reused, JSON was packed with round-trip hashes, and identical bytes reused.
No guest state/clock/position/AI writes, forcecalls, guest-code/config/media
patches or fabricated saves occurred. Prior
[paired living controls and WebGL crate arrival](halflife-current-paired-onward-20261112.md)
remain accepted and separate. No new parity, FPS, audio or full27 claim follows.

Actual `/home` free space was1654304768 bytes initially. It stayed above the floor
at the last pre-movement sample,1500979200 bytes, but was1499631616 bytes at
ordinary browser closure. No further game input followed that observed breach.
Lossless packing of this run's own API log restored headroom; final audit sampled
1511952384 bytes. This is a recorded floor breach, not an all-time compliance
claim. No RAM gate was used.

An observable independent two-hour watchdog was armed before allocation. Both
Chrome exits were code0/signalnull; actual browser outer parents waited0 and
both output EOFs were retained. Kernel custody reaped359/359 and368/368 owned
processes, with no remaining/unreaped members and complete command EOF.

The local manager's tool session ended143 around the normal-stop request,
leaving no actual manager/watchdog parent-join files. Cause remains unknown;
**no actual manager/watchdog joins are claimed**. A fresh API GET showed idle
with no stop operation; an independent delegated normal stop then completed.
The watchdog wrote its terminal confirmation and its PID disappeared.

Box **`bx_szzj35tc`** is **archived**, stopped **2026-11-12T14:53:29.850Z**,
expiry **null** (original **16:35:24.716Z**). Receipt
**`stop_e5aee35e0199cb1e`** completed, forcedfalse, errornull. See
`stop-confirmed.json`, `manager-observed-loss.json`, and the independent stop
observations. No box was deleted, resumed or left billing idle; no workers or
public deployment were used. Next work can start by mounting this earned set
and using normal Load, followed by fresh movement and onward play.
