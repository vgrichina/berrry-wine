# Quake III Arena demo 1.11

## Worker joining and download deadlines (2026-10-16)

The remaining c29ca48c1 discovery/join changes are integrated while keeping
the newer shared Q2/Q3 account-name policy. A nonempty hosting directory is
offered at launch; empty directories stay silent. Native discovery joins
adopt the room on the existing guest and send `net_restart; connect`, including
punctuation, rather than restarting Q3. Reviewed local isolated-Worker
evidence: `scratch/runs/20261016-q3-worker-join`, using the deployed WASM
with the candidate JS changes. Host `.1`, discovery client `.2`, and unchanged
client guest identity are asserted; this is Chrome-to-Chrome coverage.

Lazy HTTP file/part downloads now have a 90-second total deadline covering
headers and the complete body. Timeout aborts the fetch and rejects even if
an adapter ignores abort, so existing parked-read retries and Retry/Quit UI
can run. Late responses cannot populate the cache. This deadline is for
provider-backed game data; eager downloads and bundle requests are separate.

## Hosting banner follow-up, 2026-10-15

The shell previously equated owning a browser LAN room with running a game
server. Q3 opens its socket at the main menu, so it showed the hosting/share
card too early. Probed games now wait for a positive hosting probe; the card
is offered once per room. `Q3_HOSTING_CARD=1 node
test/test-quake3-desktop-web.js` verified no card at the menu, a card after
starting a server, and no reopening after dismissal across probe refreshes.
Reviewed captures: `scratch/runs/20261015-quake3-host-card`.

The reported client stuck at “Awaiting challenge” happened with the host
already in a map, and Q2/Blobby failed too. An isolated-worker probe confirmed
the shared defect: browser/assigned IP was `10.0.0.2`, while the guest main
worker retained the default `10.0.0.1`. Initialization and `joinVlan` updated
the idle browser instance and child threads but skipped the main worker.
Both paths now propagate the address; startup LAN pacing also reaches the
worker. `WORKER_VLAN_ONLY=1 node test/test-worker-guest.js` covers startup
assignment, late reassignment, and pacing on an actual isolated worker.

Reviewed `scratch/runs/20261015-quake3-worker-join` confirms host `.1`, client
`.2`, both executing in workers, open WebRTC datagrams, and server-side
`ClientBegin: 0` plus `ClientBegin: 1`. This focused run verifies joining and
gameplay rendering, not mobile input. The original desktop harness now accepts
`Q3_WORKERS=1`, serves isolation headers, and asserts the execution mode and
actual guest IPs. Earlier runs without isolation exercised cooperative mode
even when `no-threads` was omitted. Safari-to-Chrome was not tested locally.

Cross-game checks with `--isolate`: Q2 room test passed all 35 checks,
including four players, late console join, and invitation-link join. Blobby
passed 32 of 33: discovery, both players' movement, slow-peer traffic and
rehosting passed; hidden-host rendering produced 2/4 distinct sampled frames
instead of the required 3/4. Its peer kept moving and traffic continued.
That remaining background-rendering check is not marked passing.

App id `quake3_demo` (2026-10-10, w4). OpenGL only.

## Provenance and license boundary

- Installer `Q3ADemo.exe`, "Q3Demo v1.11 Win32", 3 Dec 1999, from
  [Jason2Brownlee/Quake3OfficialArchive](https://github.com/Jason2Brownlee/Quake3OfficialArchive)
  (`bin/Q3ADemo.exe`); the same 46.6 MiB file is on
  [archive.org](https://archive.org/details/QuakeIiiArenaDemo).
- 48,907,862 bytes, SHA-1 `95fb0e8f595506dd30b57635db151f2e0762be02`,
  SHA-256 `6af96cb1b5c97535c9923d8855ca85ec21b21b65b48738b2c5e674e17c65835d`
  (candidate `quake-3-arena-demo-installer` in `test/candidate-corpus/manifest.json`).
- The installer shows id Software's "LIMITED USE SOFTWARE LICENSE AGREEMENT"
  for "this game demo program entitled QUAKE III: ARENA". Section 3
  (Permitted Distribution and Copying): so long as the agreement accompanies
  each copy, a non-exclusive, limited right to copy and distribute the
  software free of charge for non-commercial purposes (magazine cover discs
  included); CD copies labelled "SHAREWARE" or "DEMO"; no commercial
  distribution. Section 2 forbids, among others, renting/selling,
  distribution outside section 3, and (j) publicly displaying the software.
  It was initially kept in `LOCAL_CANDIDATE_APPS`. Desktop preparation was
  requested on 2026-10-14; that branch includes the complete original installed
  demo, including `extras/help/q3a eula.htm`, in the desktop asset set. This is
  a record of the requested packaging change, not a new interpretation of the
  license or a claim that this candidate has been deployed.

## Desktop preparation, 2026-10-14

The first-launch `lib/quake3-modern-controls.ini` is mounted as
`c:\\demoq3\\q3config.cfg`; saved user configuration replaces that seed on
later launches. W/S move, A/D strafe, Space or right mouse jumps, Ctrl/C
crouches, left mouse fires, wheel changes weapons, E/Enter uses the held item,
and Shift walks. `relativeMouse: true` uses the same browser capture policy
as Quake II. Mobile has a held move pad (Up/Down also navigate menus), relative look surface, and
Fire/Jump/Crouch/Item/Weapon/Esc buttons.

The browser LAN uses an automatic room on UDP 27960. Its hosting probe sends
`getinfo berrry` and reads the real server's hostname response; the room card
launches clients with `+connect {host}`. No engine patches or native UDP
Internet access are implied: the transport is the existing browser WebRTC
virtual LAN. The standalone CLI pair remains `test-quake3-vlan-gameplay.js`.

`test-quake3-desktop-web.js` exercises trusted browser keyboard/mouse input,
measures movement and turning with the game's own `viewpos`, then joins a
separate mobile browser through the normal room card and checks the server's
`ClientBegin` log, bidirectional WebRTC traffic, touch movement and look.
Reviewed acceptance: `scratch/runs/20261015-quake3-acceptance6/` (UTC date;
2026-10-14 locally). Chrome with SwiftShader, cooperative mode, desktop plus
touch-emulated mobile browser contexts:

- All WASD directions changed the guest's `viewpos`. Mouse yaw changed from
  -45 to -52 degrees and remained -52 after release/absolute motion/re-capture.
  Escape reached the game menu. CDP does not invoke Chrome's browser-level
  Escape shortcut, so the test explicitly calls `exitPointerLock` to exercise
  release/re-capture; this is not a physical-key test of that browser shortcut.
- The room card launched the member at `10.0.0.2` with `+connect 10.0.0.1`.
  Both players reached `ClientBegin` in the server's own game log. At the
  traffic checkpoint, the member had sent 51 frames and received 157 over an
  open WebRTC datagram channel. Both guest views rendered Arena Gate.
- Touch movement advanced the client from (1024,1000,50) to (1024,1212,50);
  touch look changed yaw from 90 to 63 degrees. Fire held/released the attack
  mask (1 → 0), and the capture shows ammo consumed. Landscape (844×390) and
  portrait (390×844) controls fit the viewport.
- No guest/page runtime errors were reported. Earlier harness attempts hit
  Puppeteer's default command timeout or read an unfinished `condump`; the
  final harness permits arena loading and reads completed `viewpos` lines
  from the synchronous game log instead. No guest code was patched for tests.

Canonical build, asset/manifest-size checks, FPS touch-layout and file-policy
tests pass. The deploy dry run considers 2262 files; all 303 installed manifest
entries exist, and `pak0.pk3` is emitted as five parts. No public deployment
was performed. Physical-phone/Safari behavior and WAN/NAT conditions were not
tested by this local two-browser run.

## Running-game joins and native server browser, 2026-10-15

The release acceptance originally covered the pre-launch room card only.
Q3 also opens a socket immediately after an offline launch, producing another
room picker after command-line arguments have already been consumed. The
running-game join recipe now handles that socket-time picker (`why=1`) and
the later invitation (`why=0`); the pre-launch card still uses `+connect`.

Original demo `Con_ToggleConsole_f` at `0x406640` toggles bit 0 of
`cls.keyCatchers` at `0x6dc1a4`. Renderer startup creates the window before
the UI is ready, so the socket-time recipe waits for a nonzero catcher before
opening the console. Q3 consumes printable text through WM_CHAR, unlike
Q2's key-event recipe: `type(text, { characters: true })` explicitly opts in
to character delivery. No guest memory is patched.

Reviewed `scratch/runs/20261015-quake3-running-join4`: offline launch,
socket-time room join, console connect without launch arguments, two-player
gameplay, native `localservers` discovery, mobile movement/look/fire and
portrait controls all passed. Earlier runs exposed the second picker,
premature key injection, and missing character delivery.

Reviewed `scratch/runs/20261015-quake3-native-browser`: joined the browser LAN
with automatic connect disabled, opened the original Multiplayer menu,
selected Local and clicked Refresh. The actual native list displayed
`NONAME`, `Q3DM1`, `1/4 DM`, `UDP 155`, and `1 of 1 Arena Servers`.
The native `localservers` handler at `0x40ee70` broadcasts on ports
27960–27963; `cls.numlocalservers` at `0x6dc250` became 1. The Internet
master-server list is not the Berrry room directory: native discovery sees
peers in the browser LAN room, not every published Berrry room.

## Probe-gated room creation (2026-10-15)

The demo's socket routine at `0x4415c0` maps its `localhost` bind string to
INADDR_ANY (`0.0.0.0`), not loopback. An open UDP socket therefore cannot
distinguish the menu, solo play, and hosting. `SVC_Info` at `0x433ab0` reads
`g_gametype` and returns without replying when it equals 2 (single player).
The constant at `0x4b137c` is float 2.0. This makes the normal `getinfo` probe
a useful hosting signal without inspecting guest memory in production.

Q3 now enables `lan.openOnProbe`: it initially receives a local-only wire,
and a valid `infoResponse` promotes it to a public owner room. Native Local
discovery can open the room picker; choosing a room restarts the guest with
the assigned member IP and existing connect arguments. Explicit invite links
continue to join directly.

Reviewed run `20261015-quake3-probe-room3` passed in isolated Chrome workers:
menu and `spmap q3dm1` (`g_gametype=2`) kept no public room, hosting card,
room URL, or networked background policy. A multiplayer map promoted to
owner `.1`; a separate menu stayed offline despite that host, then native
`localservers` opened the picker and joined gameplay as `.2`. A third browser
joined gameplay through the invite as `.3`. Safari cross-browser behavior was
not tested in this run. `test/test-vlan-star.js` also covers response validation
and discovery filtering without public peers.

Q3 sends Local discovery automatically on entering Multiplayer, before the
player chooses Create or Join. Empty directory results therefore stay silent.
When other hosts exist, the picker also offers **Host a game**, which closes
it and leaves Q3's native Create button available without opening a room.
The dismiss action is **Back to game**, since it does not disable networking.

## Install

The package is Installer VISE (MindVision); neither `unzip` nor `7z` opens it,
so the original installer runs in the emulator:
`node test/run.js --exe=.../Q3ADemo.exe --vfs-include=**/* --batch-size=10000 --control-stdin --frozen`.
Welcome -> Next (452,393); Software License Agreement (scroll the text by
clicking the scrollbar track at (568,250); Page Down only moves the caret) ->
Yes (452,393); destination `c:\Q3Ademo` -> Next; Ready To Install -> Next;
copying `demoq3\pak0.pk3` (46,853,694 bytes) takes ~50k batches at
`--batch-size=10000` (about two minutes); Finished. The 304-file `c:\q3ademo`
tree was exported from `ctx.vfs` with a control `eval` (keys are lowercase)
into `test/binaries/candidates/quake-3-arena-demo-installer/installed/`, and
`node tools/gen-installed-manifest.js <installed> quake3.exe` wrote the
303-entry `.wine-assembly-browser.json`. No registry state is needed.

## Running

- Main menu (SINGLE PLAYER / MULTIPLAYER / SETUP / DEMOS / CINEMATICS / EXIT)
  draws on both GL arms. Software GL (`--gl-renderer=software`) runs at about
  13 batches/s at `--batch-size=200000`.
- Straight to a map: `--args='+map q3dm1'` (Arena Gate, free for all,
  fraglimit 20). Loading (BSP, game media, items) takes ~8000 batches at
  `--batch-size=200000`; then the player stands in the arena with the machine
  gun, 100 health / 100 ammo.
- Input: keyboard through window messages and DirectInput both work; Up moves
  forward, Left turns, Ctrl fires (holding it empties the machine gun and the
  game switches to the gauntlet, "OUT OF AMMO").
- WebGL (`--headless-gl --gl-renderer=webgl --gl-census`), 8600 batches:
  33 distinct GL entry points, 6.57M GL calls, 297k packed draws, 3160 presents.

### Whole-part HTTP validation (2026-10-15)

`scratch/runs/20261015-whole-part-games/quake3_demo` reaches q3dm1 with
the whole-GET provider. All five simulated 10 MiB pak0.pk3 deployment parts
are requested once each; no HTTP Range requests. Stable deployed WASM,
cooperative Chrome/SwiftShader, not a timing or multiplayer benchmark.
