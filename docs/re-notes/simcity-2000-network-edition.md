# SimCity 2000 Network Edition (demo) — 2KCLIENT.EXE / 2KSERVER.EXE

Apps: `simcity2000_net` (client), `simcity2000_net_server`. Files under
`test/binaries/candidates/simcity-2000-network-edition-demo/installed/`.
Both images load at their preferred base `0x400000`, so VA == runtime address.

## Headless three-seat route (server + two clients)

```sh
C="--no-build --tick-ms-per-batch=1 --app=simcity2000_net --max-batches=100000000 \
   --no-close --stuck-after=100000000 --quiet-api --max-seconds=220"
node tools/vlan-pair.js --log-dir=$T --stagger-ms=12000 \
  -- --no-build --app=simcity2000_net_server --batch-size=100000 --max-batches=1000000 \
     --max-seconds=250 --no-close --stuck-after=100000000 --quiet-api \
     --input=100:post-cmd:57600,1400:click:180:313,2900:click:231:288 \
  -- ${=C} --input=<client A list> -- ${=C} --input=<client B list>
```

Client join list (A; B adds `31200:dlg-set-edit:1015:Deputy`):
`50:click:316:276,7500:click:200:120,15000:click:315:256,22500:click:265:343,31000:dlg-set-edit:1014:10.0.0.1,31500:click:408:232`,
plus `dlg-cmd:1`/`dlg-cmd:2` every **3000** batches from 150000 to dismiss the
join notices and the January budget dialog (every 15000 is too sparse — a
budget dialog then swallows the input that follows it). The city is live
around batch ~290000; ~1950 batches/s on the dev box, so budget
`--max-seconds` accordingly (150 s ends at ~290000, too early).

**The server overflows its own stack if a login ack is slow.** While it
waits, it appends one `.` per tick to "Awaiting Player's Ack of Login
Packet" in a fixed stack buffer. On 2026-09-25, at load ~176, it then called
a function pointer the dots had overwritten (`call [ebp-0x44]` at
`0x4170dc` → EIP `0x2e2e`, ASCII `".."`). That was `unreachable` at server
batch 3254, and both clients then said "Could Not Connect".

- The server runs at the default 200 ms of guest time per batch, so a few
  wall-clock seconds of client lag is a long wait in guest time.
- This is the app's bug surfacing under load, not an emulator fault.
- Run this route only on a quiet box.
- Treat a server `CRASH` at EIP `0x2e2e` as "too slow", not as a regression.

The first client is "Mayor", the second "Deputy". Chat (post-cmd 32789)
propagates and paints on the other client since 294a49e2.

## UI is app-drawn — no windows, no WM_COMMAND

The tool palettes, their flyouts and the top toolbar are drawn by the app
itself onto its own surfaces; opening a flyout creates **no window** (only a
`SetCapture` on the frame). So `dump-windows`/`post-cmd` cannot reach them,
and flyout pixels left in the unpainted area below the view are stale, not
the live menu (the headless `png` while the button is held never shows the
flyout).

Selecting a flyout item = press on the palette button, drag, release on the
item. Route the drag through x=100 so it does not cross the lower palette
(x 130–225), which opens that palette's flyout on hover instead. The
status line at (7,123) names the selected tool — read it to confirm.

| Where (640x480, city not maximized) | What |
|---|---|
| click 18,175 | Demolish (bulldozer button default) |
| drag 18,175 → 100,195 | Level ($25) |
| click / drag 18,200 → 100,200 | Water ($100) |
| drag 18,200 → 100,224 | Trees ($3) |
| lower palette 140/165/190/213,193 | power / police / school / parks; up-arrows at y=176 open flyouts above (Oil/Hydro/Coal; Marina/Stadium/Zoo/Large/Small Park) |
| top toolbar 262,56 | land-ownership **layer** toggle (wireframe map); 285/310/333/356 are further layer toggles |

## Control response and animation clock (2026-10-10, boat runs)

`test-simcity2000-net-vlan-gameplay.js` now also drives the Mayor once its city
is live (~batch 300000 at 1 ms/batch):

- **Toolbar rotate-left (142,56)** turns the view: 79.9% of the map rect
  (50,70 580x330) changes, against 0.0% between two no-input captures, and
  the rotated view holds (0.0% over the next 2000 batches). The compass turns
  with it. **Zoom-in (189,56)** changes it again (78.0%). Zoom-out (212,56) does
  nothing from the starting view (probably already at the farthest zoom).
- **Animation clock:** `AnimatePalette` from two sites, return `0x46d08d`
  (range 0xab) and `0x46d107` (range 0xe0), about 6:1; a third site never fires.
  `--count` hit counters equal the API census exactly. 760 calls over the
  Mayor's 320 guest-seconds (2.38/guest-s on average; 4.2/guest-s over
  batches 305000-320000, where each batch does more work). The route is about
  6% nondeterministic run to run, so do not subtract counts across runs.
- Route traps: a second `--max-batches` is ignored (the test passes one; use
  `N:stop`), and `--trace-from/--trace-to` also windows the network trace, which
  breaks the "talks to the server" check.

Evidence: `scratch/runs/20261010T0715Z-simcity2000_net-boat`,
`scratch/runs/20261010T0800Z-simcity2000_net-rotate`.

## Buy Land — the Owner Tool palette button (red arrow, 18,319; confirmed)

**Did not reproduce on 2026-10-10 (main 922c5e07, four boat runs):** after
`click:18:319` and clicks on land, the Mayor's captures from batch 300000 to
320000 are byte-identical -- status line "Ready", Funds $30,000, no markers --
although WM_LBUTTONDOWN/UP reach the frame (`0x10004`, client point 12,275)
and are dispatched. Treat the confirmation below as unverified until that is
explained.

The palette flyouts are built by `0x418f46(group)`: `group-1` indexes the
byte table `0x41b664`, which selects a case in the jump table `0x41b5f8`.
Each case names its group and adds `(bitmap key, label, tool number)` items
via `0x430910` / `0x469460`:

| group | case | name (VA) | items |
|---|---|---|---|
| 1 | `0x418f8f` | Network Tool (`0x4c8b68`) | |
| 2 | `0x4191ad` | Dozer Tool (`0x4c8c4c`) | Demolish, Level, ... |
| 3 | `0x4193f8` | Water Tool (`0x4c8a04`) | Water, Trees, ... |
| 4 | `0x41950d` | **Owner Tool** (`0x4c8b3c`) | **Buy** (bmp 1013, tool 0x0d), **Sell** (1014, 0x0e), then 0x43 / 0x42 |
| 5 | `0x41972f` | Zone Tool (`0x4c8bf8`) | |
| … | `0x4199c3` / `0x419bec` / `0x419e15` | Police Fire / School / Parks | |

**Correction (2026-09-28, live city):** 18,223 is **not** the Owner button.
Enlarged, the left palette reads:

| y | button |
|---|---|
| 175 | bulldozer |
| 200 | water drop |
| 223 | water tower (red-checkered tank on a stand) |
| 247 | road |
| 271 | tunnel |
| 295 | zone house |
| 319 | red arrow |

Clicking 18,223 set the status line to "Water Tower: $250", and funds stayed
$30,000.

**Confirmed (2026-09-28, same day): the red arrow at 18,319 is the Owner
Tool, and a click selects Buy Land.**

- The status line at (7,123) reads "Buy Land: $20".
- Clicks on land at 420,330 and 300,380 then took Funds from $30,000 to
  $29,960 ($20 each), and each clicked tile gets a small marker.
- Route: the client captures below with
  `301000:click:18:319,303000:click:420:330,307000:click:300:380`, plus png
  captures between the clicks.
- The Owner flyout (arrow at ~36,319) should hold Sell; not yet tried.

Older leads, kept for reference:

`"Buy Land (P)"` at `0x4c76cc` is a network protocol command name (the `(P)`
/ `(H)` table at `0x4c7c74`). `"Buy Land"`/`"Sell Land"` at `0x4c8dec`/`0x4c8de0`
are tool names (tool numbers 0x0c / 0x0d, table built at `0x41c3e2`), grouped
with Demolish/Dezone/Lower/Raise/Level. `buyland.bmp`/`selland.bmp` are loaded
at `0x42c23d` keyed 1013 / 1014 — bitmap keys for app-drawn buttons, **not**
control or command IDs (no dialog or message map uses 1013).

Water on land the player does not own does nothing — no cost, no error. The
`"You don't own this land"` text (`0x4cd430`, used at `0x4403c5` with caption
"Place Error") never fired in any attempt. Drags to bulldozer-flyout rows
123/147/171/292/316 and clicks in the ownership layer bought nothing. The
`0x41c3e2` name→number map is a lookup by label, not the UI.

## Known render oddity

The city view paints only rows ~44–205 of the MDI client; everything below is
black and never repainted (so stale flyout pixels persist there).

**Correction (2026-09-25):** 69d6aa0b's commit message and its comment in
`$handle_DefWindowProcA` name this app as the case where a registered
`msctls_statusbar32` with no guest comctl32 behind it answered WM_GETFONT /
SB_GETBORDERS with garbage, laid the bar out 267px tall and left the view
163px high. That was observed only in a scratch worktree **without the app's
DLLs mounted**. The DefWindowProc answers themselves are correct for any MFC
app with no comctl32.

**Update (2026-09-25, same day):** the real route has no guest comctl32
either — the manifest mounts only mfc40, Msvcrt40, DPLAY, OLEPRO32 and
Webster — so it takes the same path. On main (after 69d6aa0b) a single
client lays out its status bar as 628x18 at y=412 of the 640x480 frame
(`--app=simcity2000_net ... --input=2950:dump-windows`, ~3000 batches, no
server needed), so the view gets the full height. The black band's 161-row
view matches the 163px symptom, so it was most likely this layout bug.

**Confirmed (2026-09-28):** in a three-seat run on main (6723deb6), both
clients' city views fill the MDI client down to the status bar at y≈458.
There is no black band. It was the status-bar layout.

That run:

- Clients ran with `--no-uop --no-x87-fusion` and `--max-seconds=420`.
- Captures at batch 300000; the Mayor reached 540k batches, the Deputy 480k.

Route notes from these runs:

- **The join is flaky at load ~20–30.** One of three runs ended with the
  Deputy on "Could Not Connect".
- **The clients are slow once joined.** Live network threads (T2 parks
  ~130k times on a critical section T1 holds) and tens of millions of API
  calls take them to ~1000–1300 batches/s.
- **Batch budget:** the city is live near batch 290000, so give the clients
  at least 400 s.
- **A dead-server run is not a baseline.** If the server crashed early, its
  clients never joined and their threads exit. Don't compare thread state
  against such a run.
