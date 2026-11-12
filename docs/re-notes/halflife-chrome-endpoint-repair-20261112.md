# Uplink: real Chrome control and whole12 restore pass; old timeout cause unknown

Runs: `scratch/runs/20261112-halflife-chrome-endpoint-repair-1710/`,
`20261112-halflife-chrome-endpoint-repair-1710-control2/`, and
`20261112-halflife-chrome-endpoint-repair-1710-original/`.

The frozen Chrome launch **passed an actual blank endpoint/CDP/capture/clean-close
control before the original was started in the same box**. The original then
verified the complete twelve-file VFS, loaded the earned crowbar checkpoint on
actual SoftwareGL, and demonstrated fresh movement. The historical
[1655 startup timeout](halflife-cleared-bay-onward-20261112.md) was not reproduced;
its causal failure remains **UNKNOWN**. No production repair is justified or
claimed. Missing `DevToolsActivePort` was the caller's final observation, not
an established cause.

## Frozen launch diagnosis

All589 predecessor frozen files matched locally before allocation. The browser
source SHA256 is `18b0d0f6b957a71b494fb497023c479dcf41eddf1c4ca95f3629119717b866d5`,
byte-identical to both1655 and the successful1635 caller. The custody collector
is unchanged `f8e6e8be352a20f668185c907fdcf4308f5cb93f8c6b8297fada063fc8140b77`.
The original emitted vector is `/usr/bin/google-chrome` with headless=new,
1024×855, no-sandbox, no-first-run, no-default-browser-check,
disable-dev-shm-usage, enable-unsafe-swiftshader, remote-debugging-port=0,
a unique user-data-dir and about:blank. There is no repeated unchanged original
launch: the blank control is first, then one original attempt.

The diagnostic launcher wraps the same collector only to measure its real
Journal.write/fsync calls and record bounded process observations. It preserves
ptrace returns, stop handling, durability, admission and cleanup. The control
extracts the executable argument literal directly from the frozen browser,
runs through the same Node owner-exec/owning-parent contract, and retains
actual executable/cmdline/status/environment hashes. It never starts a guest.

Actual control Chrome PID7162 resolves through the `/usr/bin/google-chrome`
Bash wrapper to `/opt/google/chrome/chrome`, executable SHA256
`22e4d5ef0c637a87b59a9baad42625aba3284dc03d4a5908748e253556318c97`.
The wrapper adds flags; the full resulting vector and parent/TGID hierarchy
are in `startup-analysis.json` and recovered launch/process evidence, rather
than inferred from the requested command alone. Environment values are hashed,
not published. Actual original Chrome PID8549 has the same executable hash;
`recovered/webgl/actual-host-launch.json.gz` retains its vector, environment
hashes, wrapper hash and profile observation.

The control publishes a real endpoint, validates its HTTP version, obtains
Browser.getVersion and SystemInfo.getProcessInfo, evaluates about:blank to42,
captures a CRC-checked PNG, and receives Browser.close. It exits0/signalnull
without TERM/KILL; all130 custody-owned tasks are reaped, outer wait0 with both
EOFs. The control's combined startup/capture/close elapsed report is2402.283ms.
Measured custody service totals are1505 fsync calls /0.746874s and1503 journal
writes /0.826616s, with zero dropped samples; writes include fsync time.
These measurements include scheduling and do **not** explain1655.

The1635 evidence reports Chrome151.0.7922.108, but retains no executable hash,
full inherited Chrome environment or per-write service timing. The1655
inter-record gaps include storage, scheduling and other tracer work, which
cannot be separated retrospectively. Empty stdout/stderr and absent exit JSON
also cannot identify its first causal failure. No historical binary/environment
identity or storage-cause claim is made from the successful control.

## Whole12 and bounded onward inspection

The authoritative [1635 export](halflife-crowbar-obstruction-20261112.md) remains
649713 compressed bytes, SHA256
`f523dfeaf57ef0f4d4c470965d4f036b3e67affde4498f203f55650db204d809`:
12 exact paths /2006166 decoded bytes. Strict base64, every size/SHA, ordinary
required mounts and all fresh VFS paths match before native Load. The same65
original media files and185 HTTP pins pass. Native menus select
OpenGL/Default/640×480, then the bottom earned UPLINK01:48 slot. Passive
postLoadReady is unchanged; later full captures wait through Loading.

`d15-readyview` restores the bay/crowbar at health100/armour0. `d16-bound`
anchors the living owner; `d17-fresh-right` visibly strafes right. Actual guest
and renderer module SHA256 both equal
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`, and the
owning context independently reports `software:true`.

The small crate is already destroyed and is not attacked again. Forward,
right-side and short left-alignment probes inspect the tall structure and the
narrow metal-jamb lane (`d18`–`d22`). One native Space jump (`d23`) does not
establish passage. The original default.cfg binds Ctrl to +duck, but the frozen
key helper accepts neither Control nor chorded movement. Crouch was therefore
**not dispatched**; no live helper mutation or guest binding change was used.

Backing clear and turning reveal the other red-lit bay direction. After a
jamb-obstructed approach, `d33-clear-to-right` exposes the Maintenance Area door
and vending window. `d34`–`d38` approach and test use; E and a distant default
Tab use do not visibly open it. **`d39-close-use` uses Tab at the newly closer
position and visibly opens the door**, exposing the familiar tool chest,
table and vending-machine room. This appears to return to the earlier supply
room, not establish an onward corridor or encounter. No enemy, health change,
new obstruction destruction or new earned successor is claimed. The close
read-only export matches every unchanged whole12 save file.

## Evidence, staging correction and lifecycle

Original postflight passes474 recovered references,41 full captures,24
postbinding captures with all22 anchored fields,35 independently released and
acknowledged pulses, native Chrome exit0/signalnull, actual outer wait0/both
EOFs and369/369 custody tasks reaped. No cancellation or remaining/unreaped
task is present. All original capture hashes/ages, passive readiness,
independent releases and terminal no-replay rules are preserved. Unchanged
focused/build evidence is reused by hash in `reused-focused-checks.json`;
there is no new production edit or build claim.

An earlier staging attempt in the first run stopped on a **local observer pin
mismatch**: the worker edited the observer after its upload pins were frozen.
That was an avoidable worker error. No Chrome was dispatched, caller admission
closed, the failure was retained and the box normally stopped. The corrected
source was frozen separately before the second box was allocated. During
control retrieval, a local verifier incorrectly compared decompressed bytes
with the hash of an already-compressed original. The retained inventory allowed
read-only recovery to continue with exact compressed hashes and gzip CRCs;
there was no source/Chrome/input replay or actual artifact mismatch.

Both boxes had independent observable two-hour watchdogs armed and observed
before allocation. Unique evidence was retrieved and SHA-verified before each
normal delegated stop:

| Box | Final state / expiry | Normal stop receipt |
| --- | --- | --- |
| `bx_h262x9ah` | archived / null; stopped17:07:31.069Z | `stop_80e5af8b2fa22bfe`, completed, forcedfalse/errornull |
| `bx_j3htstm9` | archived / null; stopped17:21:46.881Z | `stop_484005c3ae815d93`, completed, forcedfalse/errornull |

Initial expiries were19:05:36.126Z and19:07:44.434Z. No box was deleted or
resumed. The first local starter/manager/watchdog actually joined0 with EOFs.
The second starter's actual tool wait returned143; its manager-parent wait
record is absent and the cause is **UNKNOWN**. Its watchdog actual wait0 with
both EOFs and confirmed terminal record is retained. Neither the successful
remote outer wait nor the stop receipt substitutes for that missing local join.

Git is the source archive: the original freezes Git
`eec0398723f94568c7d524e9a94e791ad407651f` plus its relevant binary diff and
helper patches. Each new run retains final helper patches; the predecessor
pins reference its existing Git/patch recovery chain. No source/media archive,
guest console/state/config/AI/health/clock/position write, forced export,
worker launch or deployment was used. Sampled /home free space stayed above
1.5GB (lowest direct observation1,524,191,232 bytes); this is not a continuous
free-space claim. No RAM, parity, FPS, audio or full27 claim.

Next: retain whole12 as the checkpoint. Before another allocation, add and test
ordinary Ctrl plus independently released jump/movement chord support in a new
frozen caller, then inspect an actual unvisited route with fresh frames. Exact
1655 attribution needs a reproduced causal observation; neither ENOENT nor the
new successful launch supplies it.
