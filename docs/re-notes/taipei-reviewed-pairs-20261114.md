# Taipei: eleven manually reviewed pairs, 2026-11-14

The registered original `taipei` reached **Game #20417**, removed **eleven
personally chosen legal pairs**, and exited through **native standard Close**
with guest exit code 0. The deal was **not completed**. Three native
“Tiles don't match” dialogs and one “Tile isn't free” dialog are retained.
There was one deal, without restart, Autoplay, hints, move lists, recognition,
solver, private board reads, guest patches or settings changes.

Evidence: `scratch/runs/20261114-taipei-reviewed-pairs/`, especially
`result.json`, `manual-input-summary.json`, the selected original PNGs, and
`original/native.stdout.log`. This is separate from the historical
2026-10-10 West-pair-plus-Autoplay experiment in [taipei.md](taipei.md).

## Reviewed removals

Coordinates below were chosen from this run's submitted pixels. Each first
selection was personally viewed before choosing the second tile; each success
was counted only after viewing the settled removal and exposed/cleared area.
The `p` identifiers include unsuccessful attempts and therefore skip numbers.

| Pair | Faces and click centers | Personally viewed painted consequence | Selected evidence, under `original/` |
| --- | --- | --- | --- |
| 1 | Two characters: (97,82), (371,184) | Both cleared green; upper bamboo and right four-character edges opened. | `p1a.png`, `p1settled.png` |
| 2 | Four bamboo: (233,175), (118,223) | Top central tile disappeared, exposing underlying characters, a one-dot face and bamboo; lower-left area cleared. | `p2a.png`, `p2b.png` |
| 3 | Four characters: (350,184), (308,139) | Both right areas cleared; three dots and SUM gained open right edges. | `p4a.png`, `p4settled.png` |
| 4 | Three dots: (288,134), (288,254) | Both cleared green, exposing the red-dragon and South-wind row ends. | `p5c.png`, `p5settled.png` |
| 5 | East wind: (160,222), (328,284) | Raised East exposed a green dragon beneath; bottom-right cleared and opened four characters. | `p6a.png`, `p6settled.png` |
| 6 | White dragon: (165,110), (190,218) | Four dots and North appeared beneath the removed faces; upper seven bamboo became free. | `p7a.png`, `p7settled.png` |
| 7 | Seven bamboo: (186,110), (239,190) | Upper nine characters and central seven characters appeared; upper one character gained an open left edge. | `p8a.png`, `p8settled.png` |
| 8 | One character: (207,110), (308,227) | Eight characters appeared beneath the upper tile; lower-right cleared and opened two bamboo. | `p9a.png`, `p9settled.png` |
| 9 | Five bamboo: (139,111), (118,139) | Both cleared, leaving four dots and two bamboo at open left ends. | `p10a.png`, `p10settled.png` |
| 10 | Two bamboo: (139,139), (287,227) | Both cleared; upper seven characters and lower four bamboo became more exposed. | `p11a.png`, `p11settled.png` |
| 11 | Eight bamboo: (193,194), (255,218) | Six characters and a blue/green bird face appeared beneath the two removed tiles. | `p14a.png`, `p14settled.png` |

The native mismatch observations were attempts `p3b`, `p12b`, and `p13b`.
They reflect my visual identification errors: bamboo versus dots; SUM versus
the blue/green bird face; and eight bamboo mistaken for a green dragon. The
recorded pre-click reviews preserve those incorrect judgments; they are not
retrospectively rewritten. No removed pair is credited to these attempts.
At `p15a`, clicking the newly uncovered six-character face at (185,194)
produced “Tile isn't free.” No second tile was chosen. The remaining board was
still substantial; no deadlock or completed-deal claim is made.

## Native shutdown and evidence limits

Quit phase began at 875.425 seconds, before the mechanical 1020-second
gameplay cutoff. The native Game menu visibly contained New Game, Select
Game, Start Over, Backup and Autoplay, with no Exit. None of those items was
activated. The first titlebar X click dismissed that menu. A newly reviewed
scene then supported a separate standard Close click, which exited the guest.
`afterclose.png`, `exitmenu.png` and the empty `final.png` distinguish these
effects. No host `quit` command was used.

The CLI reported `[Exit] code=0` and 916.535 seconds. The supervisor's actual
native wait was exit 0 at 917.497 seconds, with stdout/stderr EOF and no drain
errors. Watchdog and supervisor waits were also actual exit 0 with both EOFs;
the independent watchdog did not fire. The heavy lock was released, all four
runtime PIDs were absent, and port 8597 was closed.

**Missing outer-wrapper proof:** the invoking tool ended with status 143
before its launcher could record the detached outer wrapper's wait. That
wrapper later disappeared, but its actual wait and stdout/stderr EOF cannot
be reconstructed. `original/outer-wait.json` explicitly records
`actualWait: false`, null exit/EOF values, and the limitation. This does not
replace the preserved actual native/watchdog/supervisor waits with an inferred
outer exit 0. Ancillary messageboard-watcher wait limitations are likewise
recorded separately.

**Initial binding limit:** the complete submitted native title window was
personally viewed before the permanent input-owner binding. The dealt tiles
were first viewed after the ordinary title-dismissal click. Thus the run does
not establish a literal *dealt-tile-board-before-binding* requirement; the
initial review's `nativeBoard` flag denotes the submitted app surface, whose
actual title-only content is explicitly described and visible in `baseline.png`.
No rebind or second original was attempted to replace this evidence.

## Identity, checks and scope

- Original: `test/binaries/entertainment-pack/taipei.exe`, 89,360 bytes,
  SHA-256 `d60b18ab5eeb36b9af1864c2a4b6b02df546001c8b083637660113bda4ed783e`,
  verified before and after; no downloads or media copies.
- Actual launch: `--app=taipei --real-ticks --batch-size=1000`, 800×600,
  cooperative CLI, fixed 1200-second runtime plus independent 1220-second
  watchdog deadline and irreversible 180-second Quit reserve. Registry,
  window policy, default deal, rules and guest clocks/settings were preserved.
- Tested module: SHA-256
  `c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
  Source base `16d506e4b3d39a40d51dd63ae4ae81fcfc695ed8`, relevant binary Git
  patches and 3,066 file pins are retained; no source-tree archive or WASM copy.
- Policy **10**, HTTP transport **12**, actual CLI endpoint **10** tests passed,
  followed by `flock /tmp/wine-build.lock bash tools/build.sh`, actual exit 0
  and both EOFs. Endpoint tests used isolated Solitaire fixtures, including
  identity/refusal/UNKNOWN, late ACK/EOF, parent death and independent physical
  release controls. No fixture instrumentation entered the original recipe.
- All 37 consumed clicks had distinct nonces and acknowledged independent
  release; maximum observed receipt-to-UP-ACK interval was 467.419 ms. Tile
  scenes remained below five seconds, menu scenes below thirty; pulse was
  400 ms, with the unchanged 1500 ms maximum and prearmed 1750 ms fallback.
  Three stale intents were locally NOT_SENT, including one after arming;
  fresh scenes and new intents followed. No mixed or UNKNOWN input occurred.
- Released shared controllers were read-only and unchanged. Postflight found
  peer changes to `host.js`, `lib/renderer.js` and two graphics-test files;
  these are recorded as drift and a separate patch. No zero-drift assertion
  is made for those files. The loaded module and original media were unchanged.

The new Taipei helper only validates personal review metadata and submits one
finite left click through the released transport. It contains no board reader,
matching algorithm or gameplay loop. No emulator painting/input fault was
demonstrated and no runtime source fix was made. No full-27, FPS, audio or
browser-parity claim is supported. No box was created: ID/expiry null, state
`NOT_CREATED`, stop receipt not applicable. The bounded original is finished;
further play would require a separately authorized deal and a corrected
prebinding/lifecycle setup, not continuation or replay of this one.

Only this report is committed. `tools/taipei-controller.py`,
`test/test-taipei-controller.py` and `test/test-taipei-transport.py` remain
uncommitted WIP, with exact patches in the run. Their passing controls do not
approve reuse as a solution to the stricter dealt-board-before-binding
requirement. A peer's subsequent host/renderer changes also caused the
FreeCell worker's build to stop at its callback-ownership census gate; that
later failure is not the earlier passing Taipei build, and these peer files
were not edited or included in this report commit.
