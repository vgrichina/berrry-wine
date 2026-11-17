# Win32 FreeCell: five foundation cards and native Exit

The single ordinary new deal, **#13865**, reached **five foundation cards**:
**A♣, A♦, 2♦, 3♦, A♠**. Eleven personally chosen legal moves produced settled
tableau/free-cell changes and exposed cards. A♣ and 3♦ had manually selected
foundation destinations; A♦, 2♦ and A♠ went home automatically as native
consequences. The game remained unfinished; there is no win claim.

Reviewed **Game → Exit → “Do you want to resign this game?” → Yes** closed the
native application with exit zero. CLI runtime was 849.718 seconds; actual
native wait completed after 850.151 seconds, with both streams at EOF.
Evidence: `scratch/runs/20261114-freecell-foundation-progress/result.json`.

This task uses registered app **`freecell`**, the existing PE32
`test/binaries/entertainment-pack/freecell.exe` and its registered Win32
`cards.dll`. It does not use `freecell16` or `wep16_freecell`. Their recorded
deal numbers, coordinates and corrupt WEP2 CARDS replacement do not apply.

The requested originals matched both before and after the run:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| freecell.exe | 45328 | fca27ab3ed865ea2b6727b90839cd63d6f8cb27d0e6fa96d85603fa8bdcc75ad |
| cards.dll | 157456 | 38caf8318e9a11f1f1d323a4b20544c76a2a6b29827aaf5ea178caed837f19e0 |

The executable imports CARDS, SHELL32, MSVCRT, KERNEL32, GDI32 and USER32.
CARDS imports USER32 and GDI32; the existing MSVCRT imports KERNEL32.
The registry supplies the executable, CARDS and full FreeCell help manifest.
No download, DLL replacement, Game Number selection, seed injection, restart,
Hint/Autoplay or guest board/score/clock/configuration write was used.

The route was `node test/run.js --app=freecell`, ordinary Win32 USER/GDI/CARDS
rendering, an 800×600 canvas, cooperative threads and `--no-close`. The complete
native window was 640×480 at desktop (20,20); coordinates came from its current
pixels. Startup showed the full empty native table: four free cells, four
foundations, king and blank tableau. I submitted and personally reviewed
`original/fulltable.png` before the sole permanent binding, then separately
reviewed Game and New Game. I initially added an unstated dealt-cards-before-
binding requirement. The task author clarified at 20:56:46Z that the complete
empty native table is a truthful first-New-Game bootstrap scene. No fake dealt
flag, title-only binding, rebind or transport bypass occurred. The complete
dealt board was reviewed before card input; #13865 was observed, never chosen.

Each selection and destination was separately reviewed:

| Chosen move | Destination | Settled consequence |
| --- | --- | --- |
| A♣ from column 1 | First foundation | A♣ home; 3♦ exposed |
| 3♠ from column 3 | 4♥ in column 4 | 2♦ exposed |
| 2♦ from column 3 | 3♠ in column 4 | 9♥ exposed |
| 3♦ from column 1 | First free cell | 9♦ exposed |
| 9♦ from column 1 | 10♣ in column 2 | 10♦ exposed |
| 7♦ from column 8 | Second free cell | J♦ exposed |
| 10♦ from column 1 | Third free cell | 9♠ exposed |
| 9♠ from column 1 | Fourth free cell | Native automatic-home A♦/2♦; 4♠/3♠ exposed |
| 3♦ from first free cell | Diamond foundation on 2♦ | Four foundation cards; free cell empty |
| J♦ from column 8 | Q♠ in column 5 | 5♠ exposed |
| 5♠ from column 8 | 6♥ in column 7 | Native automatic-home A♠; 10♠ exposed; five foundation cards |

`original/f4.png` shows 2♦ atop the diamond foundation and exposed 4♠.
`original/p14.png` shows 3♦ selected in the free cell; `original/home4.png`
shows it settled on the foundation and that free cell empty. `original/t5.png`
adds visible A♠ home, 5♠ on 6♥ and newly exposed 10♠. These actual scenes,
rather than input ACKs, establish the five-card count and consequences.
I did not find a feasible natural win within the remaining gameplay window
and entered Quit before cutoff.

`tools/freecell-controller.py` permits one personally reviewed native left
click at a time over the released, unchanged Barrage transport. It contains
no card recognition, board model, solver, move generator or gameplay loop.
Selection and destination require separate current scenes, card identities,
legal reasons and settled native paint. A destination also requires the
actual selected card to be visibly highlighted. Subsequent play records the
previous move's rendered consequence, including native automatic home moves
as consequences rather than manually chosen foundation destinations.

Precision scenes expire after five seconds; menu scenes after thirty.
The controller checks exact reviewed pixels and native PID/start identity.
Pulses are bounded at 1500ms, with independent prearmed 1750ms UP fallback.
Mixed/UNKNOWN receipts close input permanently. Matching all-unsent refusals
permit only a new scene, review and intent, never replay.

For later precision clicks, after personally viewing the actual settled or
selection PNG, the run-only `fresh.py` captured a new full scene and returned
whole-file hash equality and target identity. I checked that fresh capture
was byte-identical to the personally viewed reference, then separately
submitted one explicitly chosen click. This helper does no card recognition,
move selection or input delivery. It never dispatches a sequence.

There were 27 consumed clicks: two startup, 22 card selection/destination and
three Quit clicks. Five stale intents were refused locally before DOWN;
subsequent attempts used new captures and intents. No UNKNOWN input receipt,
mixed pair or replay occurred. Maximum consumed precision scene age was
4.951 seconds. Every delivered gesture had an actual independent release-child
wait with both EOFs and physical UP ACK. The maximum DOWN-to-release-completion
upper bound was 438.712ms; actual pulses were 400ms.

The sole original had a fixed 1200-second ceiling with a prearmed independent
1220-second watchdog, default 1000-block batches and real ticks. An immutable
180-second reserve closes gameplay and enters irreversible Quit. Native
menu navigation, actual Exit selection and any confirmation are reviewed
separately. Back/End Game labels cannot be misrepresented as Exit. Native
termination requires an actual target wait and both output streams at EOF;
host shutdown is a separate claim. Quit began after 827.129 seconds, before
the 1019.969-second gameplay cutoff. Exit opened the native resignation prompt;
its ACK was not treated as termination. Reviewed Yes subsequently produced
actual native, watchdog, supervisor-child and outer waits: all zero, both EOFs.
The watchdog observed actual native termination and did not fire. A later
capture was refused because native wait already existed; its closed-transport
record says `afterresign: native terminal`. This was an observation refusal,
not an UNKNOWN input. The final PNG shows the empty desktop. No host quit or
shutdown was used or claimed.

Before launch, fourteen policy tests, twelve HTTP/terminal controls and ten
actual CLI/renderer controls passed. The latter used isolated Solitaire
fixtures, never another FreeCell game. They cover submitted-scene binding,
separate clicks, identity, matching all-unsent status recovery, mixed/UNKNOWN
closure, late/dropped ACK, independent child UP, parent death, actual waits,
pointer delivery and the 1500ms bound. The actual CLI suite passed again after
shared source changes. The full build passed under
`flock /tmp/wine-build.lock bash tools/build.sh` before launch.

Initial failures remain preserved. The first predecessor gate refused Taipei's
missing ancillary wrapper wait; its actual native/watchdog/supervisor waits
and heavy release were then accepted with the missing wrapper proof explicitly
retained. The first build stopped on shared host/renderer callback-census
hashes. Their owning worker repaired lifetime handling and the reviewed census;
this worker reran actual CLI checks and the full locked build successfully.
No gate was bypassed. One attempted binding-review filename reuse was rejected
before input and replaced by a fresh menu scene.

No remote box was created: ID/expiry null, state **NOT_CREATED**, stop receipt
not applicable. All five runtime/wait-owner PIDs were absent, port 8599 closed,
the heavy lock released and /home free space above 12 GB. Source provenance is
recorded as Git SHA plus binary
dirty/new-file patches and module hashes; evidence contains no source-tree
archive, repeated media or WASM copies.
All 2931 launch source/media/module pins matched postflight, as did released
helper hashes. Thirteen selected semantic PNGs remain, all named by
`result.json`, with CRC/inflate/size/SHA checks. Other captures were removed
after review, retaining their hashes. This completes the foundation-progress/
native-Exit task, with no natural-win, full-27, FPS, audio or browser-parity claim.
