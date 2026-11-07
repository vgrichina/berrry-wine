# Forsaken threaded black-output discriminator, 7 November 2026

The registered software Direct3D route reaches the original menu and readable
Volcano gameplay with threads enabled. The fresh run reproduces a black capture
at 10 seconds, then the original Single Player menu at 20 seconds. Ordinary
Enter, thrust and fire work. No WAT/JS disagreement was demonstrated and no
production repair was made.

Evidence: `scratch/runs/20261107-forsaken-threaded-black/` (ignored).
Read the retained [matched-module startup sweep](graphics-post-allocator-crash-sweep-20261107.md)
and existing Forsaken investigations before allocating. This is one serial
cooperative/threaded discriminator, not another corpus sweep or browser WebGL
qualification.

## Identity and observed boundary

Source is main `05babd650578b76572ca8f39ca975ce6f78e9d17` plus the recorded
relevant diff and existing untracked `lib/wininit-boot.js` patch. Both actual
standard-module reads match the retained sweep: 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
All 1,328 final runtime/helper pins and 873 original media paths match locally;
remote pre/post checks and all 821 observed reads covered by those pins match.
Native dependencies pass their 162-file postcheck. Node is v24.22.1. Existing
native/capture controls were reused; remote headless-GL and WGL controls pass.
No guest setting, clock, media, binding or private handler was changed.

The passive observer delegates existing host hooks unchanged, records their
completed JS return, samples per-instance registers and 48 stack words, and
hashes the actual surface bytes. `coop-progress.json` and
`threads-progress.json` retain one-second observations. Hook completion is
**not** a final guest HRESULT or completion of a WAT operation that follows
the hook. Surface hashes are sampled reads, not atomic frame transactions.

The first demonstrated distinction from an unpresented-pixels hypothesis is
inside the target itself:

| Threaded observation | Main EIP | Execute boundaries | Present boundaries | Allocations | Primary contents |
| --- | --- | --- | --- | --- | --- |
| 9.069 s | `0x4cd387` | 3,552 | 2,310 | 132 | All zero |
| 10.069 s | `0x4cd32b` | 3,552 | 2,310 | 154 | All zero |
| 11.075 s | `0x48f291` | 4,253 | 2,349 | 162 | 536,860 nonzero bytes |

The 10-second compositor capture is black; its ordinary presentation call
returns 1. Primary and back surfaces both contain zero bytes in this interval.
Execute/Present counts stay fixed while allocation and Lock/Unlock activity
continues. This supplies evidence of absent new geometry production during
that resource-processing interval, rather than nonblack pixels lost solely by
the compositor. Subsequent geometry, nonblack target bytes and reviewed menu
prove recovery in the same original process. The cooperative run also has
black-target intervals with unchanged Execute/Present counts and continued
allocation, followed by nonblack targets. There are 22 black-primary and 83
nonblack-primary cooperative samples, versus 10 and 128 threaded samples;
the latter includes gameplay and these totals are not performance comparisons.

The main guest is running with sampled yield/wait zero during these black
intervals. It progresses through `0x4cd2c2..0x4cd40e`, rather than remaining
parked at one wait. Retained original disassembly shows byte reads, lookup
tables and conversion loops there; its exact semantic function name remains
unknown. Auxiliary workers start/exit and the scheduler continues. The threaded
callback-lifecycle receipt has zero events/pending entries; sampled multimedia
callback-active flags are zero. These observations do not prove correctness
of every wait/callback or exclude an unsampled transient context error.

No first **incorrect completed operation** was identified. The old sweep's
threaded final EIP `0x4cd32b` lies in the same progressing loop, consistent
with sampling a resource-processing interval. Its sparse retained log cannot
prove the exact historical blackening operation. The remaining causal boundary,
if transient black intervals themselves require a fix, is the first original
clear/reinitialization and its guest caller before this conversion/allocation
phase, with complete API returns and resource identities. The present evidence
does not justify a scheduler, submission, clear, blend or compositor patch.

## Reviewed original progress

Named captures below are under `retrieved/actual/threads/`; copies inspected
during execution are under `early-captures/threads/`.

- `sample-10.png`: uniformly black; `sample-20.png`: readable original Single
  Player menu over the textured 3D background. The cooperative 10-second menu
  was also personally inspected.
- `menu-now.png`: Single Player submenu with Start selected after Enter.
- `start-menu.png`: original Single Player Game / Start / Level Volcano panel.
- `briefing.png`: despite its command label, already the readable starting
  room, crosshair, LIVES 5, SHLD/HULL 128, PULS 2000 and MUG 5.
- `after-thrust.png`: after A 1,800 ms, the view has moved through the central
  doorway into the textured metal corridor, with the same health/ammunition.
- `after-fire.png`: after Ctrl 1,600 ms, PULS is 1946 and the corridor remains
  readable. This establishes firing response through ammunition consumption;
  no projectile-at-capture, enemy hit/kill or new objective is claimed.

Three Enter pulses of 120 ms followed the reviewed menus. All five presses arm
UP independently before DOWN. The threaded control channel has 22 exact success
ACKs including captures and ordinary quit, ten balanced keyboard events, no
UNKNOWN, no replay, and empty terminal held/pending sets. These are ordinary
CLI renderer input events, not browser trusted-native-event evidence.

## Verification, harness limitations and lifecycle

Existing second-instance D3DIM Worker pixel parity and control-stdin regression
tests pass. Evidence analysis, module/read/pin checks and helper syntax checks
pass. No production source change, fail-before/pass-after repair regression or
new full build is claimed. Retained module and controls are used as requested.

Run-local setup mistakes are retained: a helper edit during staging tripped a
local hash assertion before its transfer; final helper versions and remaining
inputs were staged and verified before launching. One capture lookup preceded
file creation. A read-only attempt to open the runner's stdin socket through
`/proc` failed before writing an ordinary quit command. No guest input was sent
by that attempt. The cooperative arm and its parent driver were then stopped
before the first threaded launch; its exit is SIGTERM, not a normal quit/code-0
claim. A corrected file-driven ordinary control channel served the single
threaded arm, which exited 0 after 138.348 seconds. There was no original replay
or overlapping heavy runtime. The unused initial pulse path was never invoked.

The reused remote cleanup helper incorrectly says input was not injected.
`analysis.json` explicitly corrects that wording with the complete balanced
threaded command evidence. Its process census is valid and empty; no browser,
port or profile was created. Local source identity and owned helper patches
are retained without source/media archives.

All **76 remote references / 68 unique contents**, 19,496,511 referenced bytes,
including logs, PNGs, native modules and both WASM modules, were retrieved and
SHA-256/size verified before normal box shutdown. Both launch floors exceed
5 GB. The independent detached 25-minute watchdog was armed before allocation
and never extended. Box **bx_ame2gydy**, created 22:57:31Z with original expiry
**23:22:31.967Z**, is **archived**, current expiry null. Normal stop
**stop_7dd40d405afc5e0e** completed **23:04:09.514Z**, forced=false, error=null.
Both lifecycle delegates exit zero and their supervisor has no remaining
children. Owned runtime processes, input, ports/profiles and watcher are
released. No stopped box was resumed/deleted and no public deployment occurred.

Reviewed software menu, movement and firing are established. The historical
20-second black endpoint alone is insufficient evidence of a persistent
threading defect. Browser WebGL, scene parity, FPS, audio and level completion
remain outside this task.
