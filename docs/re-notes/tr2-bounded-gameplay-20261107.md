# Tomb Raider II bounded browser gameplay — 2026-11-07

**Ordinary forward translation and a distinct weapon-draw action personally
reviewed in Venice, with owning WebGL Worker evidence.** This closes the narrow
movement/action gap left by `9218af507` under GLD3D-CORPUS-27-20261006. No emulator
defect was demonstrated and no production code changed.

Evidence: `scratch/runs/20261107-tr2-bounded-gameplay/`. One original on one fresh
boat, `bx_renx76cm`; no second original, replay, old403 resume, nested worker,
media replacement, guest/save/config edit or shared local runtime/build use.

Before allocation/original, generated controls passed: nine atomic transport
cases, seven actual executor/recovery cases, balanced production-renderer and
DirectInput keys, and invalid durations 0, 49, 2001, 3500, -1, NaN and 100.5.
Invalid holds reject before writer lock, command/ID publication, admission,
app reads or key events; valid bounds are 50–2000 ms. The run-only adapter adds
validation at both request entry and executor entry. The corrected generated
property sheet has separate ILT/IAT, ordinary flags, and a personally reviewed
tabbed page with explanatory text, OK, Cancel and disabled Apply. Its Worker
log confirms native COMCTL32 loading and successful DllMain.

The original began at 00:55:40.073 UTC. The current Graphics page was personally
reviewed: Hardware 3D Acceleration, full-screen 640x480 High Color and Z Buffer.
Ordinary OK received a complete ACK and reached Venice. Each input was based
on its current personally reviewed capture, within the adapter's scene guard:

- `review/venice-idle.png`: settled initial alley, empty hands and Lara facing
  the orange lattice window uphill.
- Balanced Up 1600 ms, then 900 ms: `review/forward-settled.png` shows running
  gait; this intermediate frame alone is not called settled proof.
- A separate 5000 ms without input produced `review/walk-after-idle.png`:
  Lara stands idle farther uphill with the nearby brick corner shifted left,
  changed floor position and closer slope/window. Facing is unchanged and no
  turning input was sent. The persistent spatial change after movement settles
  demonstrates translation. Up is running; Shift-walking was not tested.
- Balanced Space 300 ms, then 5000 ms: `review/weapons-drawn.png` shows raised
  arms with visible pistols and a health HUD. After another 6000 ms without
  input, `review/weapons-ready.png` retains the distinct weapon-ready pose.
  This demonstrates draw weapons, not firing or combat. Alt jump was not sent.

The [original PC manual](https://cdn.akamai.steamstatic.com/steam/apps/225300/manuals/manual.pdf)
identifies Up as forward running, Space as draw weapon and Alt as jump (pages
2, 5 and 7). `controls-reference.json` records the source. All six original
queue commands have complete ACKs; no stale refusal or partial/UNKNOWN input
occurred. No combat, damage, kills, audio, FPS, backend parity or full27 claim.

At `weapons-ready`, the returned owning endpoint counters identify legacy
WebGL endpoint 1: 17142 draws, 54103 draw calls, 72364 triangles, errors 0,
fallbacks 0, software draws 0 and fallback-software draws 0. Direct CDP inspection
of the actual D3D render Worker identifies endpoint 1, backend webgl,
failed=null, ready=1, error=0, completed=935, batches=633 and commands=54656.
`render-evidence.json` distinguishes these direct control/identity readings
from endpoint counters returned through the guest Worker; no separate GL-call
instrumentation was installed. Renderer: ANGLE Intel UHD Graphics 620,
WebGL 2.0; Chrome 151.0.7922.108. Both guest and render Workers supplied actual
Wasm bytes with SHA-256
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`.

Staged source commit: `cdf3d3f9aebf6c616f3ba7d3f00d30d7a642d78d`, relevant dirty
and new-source patches retained. The existing module was reused without a
local rebuild; source staging identity and actual loaded module identity are
recorded separately. All 574 remote file pins match before and after, and all
171 successful original HTTP responses match; five non-200 responses are
retained in the audit. No source/media archive was created.

Exact supplied fixture hashes were verified against retained evidence:

| Existing path under `test/binaries/` | Bytes | SHA-256 |
|---|---:|---|
| `candidates/tomb-raider-2-demo/game/TOMB2.EXE` | 909824 | `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa` |
| `candidates/tomb-raider-2-demo/game/DATA/DEMOPC.DAT` | 2064 | `e1bdd5776e1946420e0eeb9e1a4da12f16ea2bbfb7c3909b414372b100ff51bd` |
| `candidates/tomb-raider-2-demo/game/DATA/BOAT.TR2` | 5920318 | `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e` |
| `dlls/comctl32.dll` | 577808 | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4` |

Upstream `provenance.json` and historical native evidence remain absent.
Historical attribution is `tr2_demo_02.exe` from Tomb Raider Chronicles; local
hash agreement does not recover upstream provenance.

All 95 final remote artifacts were retrieved or matched locally. An initial
retrieval stopped on a local exclusive-create collision with an already fetched
generated log; remaining retrieval verified existing bytes and downloaded only
missing files. It did not repeat guest input. The reused post-pin checker prints
an obsolete constant `originalLaunches:0`; the launch/queue records establish
exactly one original, and the checker establishes file hashes only.

Chrome exited normally with code 0 at 00:57:41.143 UTC. Runtime processes are
absent, both ports refuse connections, profile and writer lock are absent.
The task's explicit normal-stop requirement delegated this box's stop:
`stop_9f9533f82fb8a8b1` completed at 00:58:20.709 UTC, forced=false, error=null;
box archived, active expiry null. Allocation through stop took about 250 seconds,
original start through stop about 161 seconds, below 35 minutes. Local free disk
stayed above 2 GB. No automated risk flag occurred. Findings only are published;
no production-code build claim. Remaining gameplay areas need separate evidence.
