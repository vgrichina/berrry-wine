# Jedi original demo: preflight passed; controller freshness stop in sector267

The single original campaign reached the western passage, then stopped **alive
at the controller's position-freshness guard before the next keydown**. No armed
hostile was positively identified; no shot, target effect, damage, death,
pipe clearance, restart or second campaign occurred. This is a controller
limitation, not a demonstrated guest collision, input scheduling or death bug.
Evidence is retained in gitignored
`scratch/runs/20261103-jedi-preflighted-native-encounter/`.

## Observed blocker and timing

I personally reviewed the original launcher, unskipped movie captures,
Player/Medium form, Single Player/New Game menus, courtyard, western movement
captures and final blocker/neutral images. The sampled route was
**874 → 266 → 267**, short of the known stairs/duck route. All sampled gameplay
health, shields and ammo remained100. Civilian65 was not targeted; Bossk266's
static placement was never treated as visual identification.

Four bounded controls completed: Left requested0.2 host seconds, then Up
requested1,2,2 host seconds. Each operation sampled fresh state before input,
used a controller-owned release timer with finally release, then sampled and
captured after release and observed a short neutral interval. Monotonic intent,
dispatch receipt, release-completion and observation events are retained in
`retrieved/session/bounded-events.jsonl`. Actual down/up **intent** gaps were
229.647515,1234.729449,2145.458331,2008.337657ms, including synchronous request
overhead. These are neither isolated physical hold times nor physics durations.
All four down/up pairs reached renderer dispatch, check_input and GetMessageA;
`actual-input-delivery-trace.txt` retains the corresponding guest messages.
Final Up release dispatch was batch457405; no fifth keydown was submitted.

The next controller operation, `western-corner`, compared its fresh player
position with `west-turn-point-state.json`, the earlier post-release capture:

| Boundary | Host UTC | Batch | X / Y / Z | Original last tick / accumulated ms |
| --- | --- | --- | --- | --- |
| Immediate post-release sample |13:39:30.286|457411|−1.798464 /5.315002 /0.270111|260893 /60506|
| Reviewed capture's memory sample |13:39:30.341|457414|−1.834323 /5.315002 /0.270111|260950 /60563|
| Short neutral sample |13:39:30.475|457610|−1.901737 /5.315002 /0.270111|261119 /60732|
| Next fresh pre-control sample |13:39:46.966|490865|−1.919990 /5.315002 /0.270111|277589 /77202|
| Blocker capture's memory sample |13:39:47.275|490868|same position|277589 /77202|

The reviewed-capture-to-fresh distance was **0.085667491**, exceeding the
controller's0.08 threshold by0.005667491. The controller captured the blocker,
wrote its stop request and sent **no input** for that operation. Its comparison
used the earlier capture rather than the later neutral sample; the latter's
distance from the fresh sample was only **0.018253565**. This conservative
guard/reference choice terminated the campaign. It does not establish unsafe
movement, continuing held input or a broken game. No guard repair or retry was
attempted in this task.

There were16.625 wall seconds between the reviewed capture's memory sample and
the fresh pre-control sample, with ordinary gameplay continuing. The immediate
post-to-neutral samples span189 host milliseconds and226 accumulated simulation
milliseconds. Original update0x4dd8f0 clamps timer delta to10–500ms before an
optional scale and accumulator update. These sparse readings do not count
updates or timestamp engine input consumption. No batch-to-time conversion,
equal host/simulation-duration assumption, velocity attribution or scheduling
bug claim follows. PNG and state are sequential requests; a rendered frame need
not represent the exact memory boundary. `timing-findings.json` retains full
precision and all pre/post/neutral samples.

## Original observation and integrity

Original JkDemo.exe is1388032B, SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`.
Fresh extraction verified09fuelstation.jkl3547906B, SHA256
`3cc6db585f16f2976d12750848498a39942088bad85372882c934c0e506572ae`.
Original Coords0x4eec10's174 bytes were reverified from the restored executable
and at every live observation against
`d94012c127c570f20b7ebd4fb9f611a36725449bb38a327ccff0c2a167ff3652`.
Original health0x502820, inventory0x503270/0x4d2270 and clock0x4dd8f0 code
were also freshly pinned and disassembled. Pure host DataView reads followed
worldGlobal0x8339d0 → world+0x124 → local player, then sector+0x5c,
orientation+0x88, XYZ+0xb8, health+0x134 and playerInfo+0x1c0 inventory bins.
World/player were null at their expected movie/loading boundaries, then freshly
resolved as0x1399d58/0x1c0d31c. No predecessor pointer reuse, memory scan, engine
call or guest write was used. The observer records original timer globals and
published host guest-clock readings separately.

Before/after checks preserve all28 original files/39900850B, genuine
DSOUND.VXD/DDHELP and178 runtime members. All17 full captured VFS/registry
checks pass;16 child captures contain only the allowed Version0.1 registry
addition. The parent's exported76 entries remain unchanged. No configuration,
asset patch, cheat, fabricated save, skip or guest-state write was supplied.

## Sealed execution and qualification

Source is committed main **44a412199a36bc69cacedcb5db240f9ec126748b**, after
clock-fixture444c9c17a and staging-preflight44a412199. All5827 exact Git-blob
inputs were streamed to the fresh boat, excluding foreign WIP, with no clone,
checkout copy or worktree. Every input was unchanged after the fresh locked
`flock /tmp/wine-build.lock bash tools/build.sh`; Git-dependent comparison gates
retain the no-repository-metadata limitation recorded in the build log.
Module2088037B, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.
Actual compile and completed-instantiation receipts match for launcherPID12300,
gamePID12714/control8144 and ordinary duplicatePID12742/control8145. The
duplicate found the original game window and exited through its own code.

The [reviewed staging recipe](jedi-cli-staging-preflight-20261103.md) regenerated
the source-derived178-file CLI closure, including disasm, VM compiler data,
system/font policies and verified pngjs7.0.0. No donor-manifest allowlist was
used. The original helper rejected older-module reuse because TODOS.md and
ops/STATUS.md also changed; this task's stage helper instead requires its own
fresh matching build/source seal. Dependency derivation and strict preflight
were retained. All seven omission controls reject both missing membership and
actual import/data execution. The **final staged boat runtime** passed strict
no-guest preflight before the sole original launcher started.

Nine focused tests pass: shell CLI routing, WinExec readiness, keyboard message
lParam, process desktop, restored input-consumption clock domain, guest clock,
startup clock, batch clock and control-server step progress. Original clock
assertions and five mutation rejections remain intact. Four no-guest observer
and four synthetic controller/error-release controls pass; these are distinguished
from actual guest delivery above. Five exact staged clock/input tests also pass.
Unrelated existing inputstate/mainSchedulerObserver and source-only CLI trace
DispatchMessageA marker failures were not repaired, rerun or counted as passes.
No production code changed.

Preflight did not qualify PE/guest paths. Actual loading retained absent-real
shell32/comctl32/ole32 warnings; subsequent movie/menu/gameplay rendering is
observed, not a general resolution of those warnings or DLL compatibility.
One ordinary **Play → full movie → Player/Medium → Single Player → New Game**
session started13:34:51.530029Z with guest1200s/outer1260s and immutable outer
deadline13:55:51.530051Z. First-blocker cleanup ended after301.056208168s,
exitCode−9: process-group TERM required KILL after5s. This is separate from the
boat's normal stop.

## Preservation and closeout

Only fresh boat **bx_d24c6u5t**, TTL7200, original expiry
**2026-11-03T15:31:12.614Z**, shutdownOwner `jedi-preflighted-native-encounter`,
was operated; identity/expiry/ownership were recorded before use. This task
explicitly delegated its normal stop after preservation. No subworker, Chrome,
predecessor boat, held/HeroesII/laptop lane or public deployment was involved.

All164 remote payloads passed stored/decompressed length and fullSHA checks.
Retrieved archive7956384B, SHA256
`bfac3d282b2dea8c8cf46c484a1ed3060844184b9d3c2c7add84a935c9799f4f`.
All5827 source blobs were independently verified locally. `RECOVERY.md` was
uploaded and independently retrieved byte-for-byte **before** the delegated
normal stop; recipes, original-input pins, full manifests, disassembly,
controllers, module, instance receipts, timing and screenshots are local.
Scoped helpers and ports8143..8159 are absent.

Own normal stop **stop_a1bf686cc7f3b938** completed
**2026-11-03T13:42:24.305Z**, **STOPPED/error:null/forced:false**, with normal
snapshot available and retained. No assigned box remains running; /home stayed
above2GB free. This single task ends at the controller blocker. Any next campaign
needs separate authorization and should first review the capture-versus-neutral
freshness reference; no second campaign or fixture repair is part of this work.
