# Uplink passive post-Load readiness and onward attempt — 2026-11-12

Run: `scratch/runs/20261112-halflife-stable-load-onward-1510/`.

Onward progress and a successor native checkpoint are **qualified** at the
upper control deck beside the scientist and security guard, health100 / armour0,
elapsed01:30. Normal Load from qualified1430 returned to its chamber entrance;
fresh strafe worked; ordinary movement climbed the stairs and reached the NPCs.
Native Save → complete export → move away → normal Load → fresh strafe then
qualified the successor in this browser.

The starting qualified1430 checkpoint contains four files,324084 bytes, at the
chamber entrance, health100 / armour0. The authoritative export remains
unchanged. The previous1500 attempt's first causal refusal was `renderEndpoint`
changing from `none` to1 during its first post-Load screenshot; it did not prove
a failed save.

The run-specific emitted caller now accepts `postLoadReady:true` only on a native
click. After its acknowledged DOWN/UP and before capture, it passively observes
the registered process, actual GL endpoint and actual owning renderer Worker.
Readiness requires a live adapter/instance and context with a native HWND,
unchanged endpoint/target/context observations for at least750ms. It does not
invoke guest exports, force GL calls, or send extra input. The existing capture
helper is byte-identical to1500: within-capture identity equality, all22
postbinding fields, module hashing, full-frame/hash/age checks, release and
terminal no-replay policy remain intact.

The actual emitted `execute` path passed a local Chrome test spanning no endpoint
through the production process factory, physical render Worker, and public native
SoftwareGL context creation. Only its generated producer pauses before cleanup;
the renderer/module/endpoint implementation is unchanged. Capture follows settled
ownership; the scenario then resumes its ordinary context cleanup and closes its
physical Worker. Chrome exits0. Five readiness negatives and102 emitted key/wait
forms pass. Exact staged import closure and missing-dependency controls pass;
unchanged binding/release/save/API1…600 and21-second ACK/no-replay checks are
hash-pinned and reused, rather than rerun.

## Actual emitted readiness and world proof

`n13-nativeload` is the first post-Load capture. Its click had both DOWN/UP ACKs;
passive readiness observed actual GL ownership before capture. The full frame
shows Loading, with endpoint1 and a live SoftwareGL context on HWND65564.
`n14-loaded` restores the earned stair chamber; `n15-bound` binds that owner;
`n16-fresh-move` visibly strafes right. The first1500 failure is resolved on this
actual path without weakening its capture identity checks or replaying input.

`n23-climb`/`n24-climb` show ascending stairs and the upper landing. In
`n25-landing`/`n26-scene`, the scientist and guard appear and move on the control
deck. `n27-step-right` clears the stair rail; `n28-deck` reaches them at close
range on the flat upper floor. Every reviewed frame retains health100 / armour0.
The subsequent menu captures show an ordinary new save slot. `n33-export` shows
Saved; `n34-away` shows the player back toward the stairs with the NPCs distant.
The native list in `n37-loadgame` highlights UPLINK01:30 above the older00:45.
`n38-loadselect`/`n39-loadconfirm` are the ordinary current-game confirmation.
`n40-restored` returns to the close scientist/guard position on the upper deck;
`n41-restored-move` visibly strafes right, moving them out of view.

Both actual guest and owning renderer modules are
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The actual renderer context reports `software:true`, with backend Object;
SoftwareGL is qualified independently of the page dropdown. All22 fields remain
anchored through the successor Load. No terminal refusal occurred.

## Complete successor export and recovery

The authoritative emitted export is
`recovered/webgl/earned-native-save-n33-export.json.gz`,158512 compressed bytes,
SHA-256 `127dc22406ec82235fc489d4573a971915eeaa81c8e572cac4bc8fb38b4ebd1c`.
`successor-save-manifest.json` records every complete native path/size/hash.
All five files total483845 bytes:

| Native filename under the recorded save path | Bytes | SHA-256 |
| --- | ---: | --- |
| `half-life-000.sav` | 164727 | `7df87bd87c7e0b46f5bad250407bd13c6d8cf6fab2e0e0e82521f3ccbf54b346` |
| `hldemo1.hl1` | 155642 | `d5d14a45b3aad49ef42bc6bfd6506dfdd8d3f789cf155bbc9f98b7a51bcdebbe` |
| `hldemo1.hl2` | 1228 | `7e16cd0f7dccfed092c4f40baf4b582bfd375c0fb99c38aedf8cce2f0755e583` |
| `hldemo1.hl3` | 4 | `df3f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81119` |
| `half-life-001.sav` | 162244 | `33bacf5f3d8724350b564a47820140c5a5a4e8c835cb8a5bd2c5d8e81130596e` |

Run `successor-recovery.py` to verify the complete compressed export, base64 and
every file hash; `--prepare` additionally creates ordinary required loader mounts
for all five files, preserving their recorded VFS paths. Select the newest
UPLINK01:30 / `half-life-001.sav` through native Load. Establish a new capture and
owner chain, review the world and verify fresh movement before further play.
A fresh-browser successor restoration has not yet been tested. The existing1430
whole export is unchanged and independently reverified after this run; retain it
as its own complete four-file checkpoint. Its original `.sav` also remains
byte-identical inside the successor export; current `.hl` auxiliaries belong to
the new complete set.

The next gameplay target is the scientist/console route, then elevator/red-crate
or another distinct room/encounter. Prior paired WebGL crate evidence remains
separate. This run establishes upper-deck progress and native save continuity;
it adds no combat, parity, FPS, audio or full27 qualification.

## Evidence, resources and closure

Frozen source commit: `93fd758a40fab68fd71e11224e652881e281de29`.
`relevant-source.patch`, `relevant-untracked-source.patch`, `fixture-source.patch`,
`new-helper-patches.patch` and `final-helper-patches.patch` preserve the relevant
dirty runtime, local fixture and run-specific helper hunks. Git is the source
archive. Original65-file media and exact580-file staged closure passed; remote
import-only checks passed before browser startup. No source-tree/media archive,
guest state/config/clock/position/AI writes or forced guest calls were used.

`postflight.json` verifies479 recovered artifact references,42 full captures,
27 postbinding captures with all22 fields intact, and83 trusted native events
(17 balanced mouse clicks and16 balanced key pulses). Unique evidence was
compressed with readback; the terminal API log shrank1805467→152851 bytes with
exact decompression/hash verification. The measured `/home` samples stayed
above1.5GB; minimum recorded1628446720 bytes. No RAM gate was used.

An observable independent two-hour watchdog was armed before allocation. Chrome
exited0/signalnull; the actual outer browser parent waited0 with both EOFs.
Kernel custody reaped385/385 owned processes, with none remaining/unreaped and
complete command EOF. All unique evidence was retrieved and hash-verified before
delegated normal stop. Manager and watchdog actual parent waits are both0 with
both output EOFs.

Box **`bx_h9s5rw9a`** is **archived**, stopped **2026-11-12T15:29:28.342Z**,
expiry **null** (initial **17:16:48.406Z**). Receipt
**`stop_541934d87b2b6d93`** completed at15:29:28.403Z, forcedfalse, errornull.
No box was deleted, resumed or left billing idle. No workers or public deployment
were used. Only run-specific caller/evidence helpers and this note changed; no
production code or new production build is claimed.
