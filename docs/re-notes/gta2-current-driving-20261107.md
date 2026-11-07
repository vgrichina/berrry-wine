# GTA2 original Wild Demo current walking and driving — 2026-11-07

Ordinary walking, native vehicle entry and distinct driving translation were
personally reviewed on the actual browser presented surface with an owning
WebGL renderer. The October 27 fullscreen GetAttachedSurface failure did not
recur. No emulator defect was demonstrated; no production code changed.
This is narrow gameplay evidence for GLD3D-CORPUS-27-20261006, not a combat,
audio, FPS, backend parity or full27 result.

Evidence resides in `scratch/runs/20261107-gta2-current-driving/`. One original
ran on one fresh separate boat, `bx_ksx8wx25`. There was no old403 resume,
second original, replay, worker spawn, source/media archive, guest/media/save/
config patch, replacement asset or shared local runtime/build acquisition.
The retained readme supplies the ordinary controls: arrows for movement and
turning, Enter for vehicle entry. All gameplay key holds were at most 2000 ms.

Before the original, `test/test-directdraw-surface47-abi-candidate.js` passed
on the separate boat through generated guest x86, the public COM factories and
vtable calls. The retained regression includes trailing words
`[0xdeadbeef, 1, 31]`: pre-DX7 creating-interface legacy matching succeeds
through Surface4/Surface7 views, while DX7 still returns `0x887600ff` and caps1
matching remains enforced. These are the retained regression words, not a
claim to have recovered the exact October 27 request bytes. This exercises the
59a615fc5 repair without changing its semantics. The first preparatory Node
invocation rejected an obsolete command-line flag before execution; Node 24
without that flag passed before the original launch.

Generated keyboard controls passed balanced production-renderer down/up and
physical-state checks. Invalid holds 0, 49, 2001, 3500, -1, NaN and 100.5 reject
before transport publication, admission and key events; accepted bounds are
50–2000 ms. In the actual Chrome session, an about:blank preflight recorded
five balanced trusted native key pairs, including Enter, before selecting or
launching GTA2; rejected durations emitted zero events. See `key-controls.json`,
`duration-controls.json` and `retrieved/original/native-key-preflight.json`.

The original launched at 01:06:05.966 UTC. The native Play menu and each scene
were personally reviewed before admitted input. The capture sequence shows:

- `review/play-page.png` and `review/walk-up-settled.png`: gameplay at the round
  brick pad in the park. Subsequent bounded forward holds move the player south,
  with the pad receding, then the stairs and narrow alley passing the camera.
- `review/street-settled.png`, `review/west-walk.png` and later street captures:
  walking changes the building frontage, alley and curb positions. World
  landmarks establish translation beyond gait or traffic animation.
- `review/south-road99.png`: player on foot near the gray passing car and the
  stationary row of other vehicles beyond the grass median. An earlier Enter
  attempt with no adjacent car had not established entry.
- Enter 2000 ms produced `review/vehicle-enter100.png`, then no-input settling
  produced `review/entry-settle101.png` and `review/entry-settle102.png`: the
  gray car is taken, a $50 award appears, the former driver departs north and
  the on-foot player is no longer beside the car.
- Up 2000 ms, then a second Up 2000 ms, produced `review/drive103.png` and
  `review/drive104.png`. The SHARK vehicle banner appears. The gray car stays
  near camera center while the STOP marking, gantry, crosswalk and hanging
  traffic light shift left. `review/driving-settled105.png` supplies a final
  no-input view with further vehicle coasting and distinct landmark positions.

All 107 numbered commands, including captures and quit, have complete ACKs.
Seven stale-scene refusals explicitly report zero effects before dispatch;
those were refreshed using new IDs. No partial or UNKNOWN input occurred and
no command was replayed. The cleanup helper always writes the literal
`pending: "UNKNOWN; never replay"`; that generic terminal label is not an input
outcome. The ACK records and `input-summary.json` establish actual outcomes.

The final direct CDP inspection of executing D3D render Worker target
`3421938818894FD01FA667D6F720BE4E` identifies endpoint 1, legacy API, backend
webgl, adapter present, failed=null, ready=1, error=0, completed=27915,
batches=18084 and commands=506580. Direct adapter software completions are 0.
The guest Worker endpoint counters report 400703 draws, errors=0 and fallbacks=0.
Renderer identity is ANGLE Intel UHD Graphics 620 / Mesa 23.2.1, WebGL 2.0;
Chrome 151.0.7922.108. Counters identify the owning renderer and do not establish
FPS. The browser screenshots, rather than a generic CLI slot7 surface, are the
visual evidence.

Actual executing guest and renderer Wasm bytes were retrieved with SHA-256
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`.
Executing guest-worker.js SHA-256 is
`03ec369b4f3ed4509d81c525f51e609e499419fc976d04088960ca1d5837638f`;
d3d-render-worker.js is
`39f05922d77b8dcbb31807512ec5c6f682e241d508cf675a8bfd8c8d421d80cf`.
All 37 executing JavaScript source identities match staged pins. Source staging
commit is `ffce252bf52b70092425a3b4dd3a3adc6781c63b`, with relevant dirty hunks
and the new wininit source retained as binary patches. The existing module was
reused; this does not assert a new clean build from that source commit.
All 651 staged file pins match before and after. All 251 comparable full
successful HTTP responses match pins; five other responses remain in the audit.
App-local SHELL32/OLE32 loading used the runtime's recorded builtin stub fallback;
no replacement DLLs were introduced. WebGL software draw fallback counters are 0.

The supplied original installed EXE and Miles DLL match the retained notes:

| Path beneath `test/binaries/candidates/gta2-demo/installed/Program_Executable_Files/` | Bytes | SHA-256 |
|---|---:|---|
| `gta2.exe` | 2893824 | `97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3` |
| `mss32.dll` | 331776 | `0974b244354a5d13e0711db15430c05f7949dc279b63897146f304d1401153fc` |

All 69 registered media paths plus those two files are present and hashed in
`fixture-identity.json`; the current installed tree contains those 71 files.
The historical note's 73-payload count differs, so this result asserts complete
registered inputs, not a reconstructed 73-file distribution. No missing
registered authentic input blocked this run. The absent original installer and
upstream provenance were not recreated; retained local hashes identify the
supplied bytes.

All 929 inventoried remote artifacts were retrieved or verified against exact
local bytes. Ordinary quit closed Chrome with code 0, removed the profile and
writer lock and closed both ports. An immediate inventory caught the controller
finishing exit; the subsequent final process check confirms both recorded PIDs
absent and ports refusing connections. Explicit delegated normal stop
`stop_7fb4a2c67db2e18e` completed at 01:31:05.230 UTC, forced=false, error=null.
The boat is archived with active expiry null. Allocation at 01:03:54.111 through
retrieval and completed stop took about 27 minutes 11 seconds, below 35 minutes.
Local free disk stayed above 2 GB. No automated risk flag occurred.

Findings only are published. No production code changed, so no production build
was run or claimed. Further combat/audio/performance/parity work needs its own
evidence; walking and vehicle entry/driving are established by this run.
